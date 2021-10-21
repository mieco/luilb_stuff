var express = require("express");
var router = express.Router();
const fs = require("fs");
var iconv = require("iconv-lite");
const cheerio = require("cheerio");
const path = require("path");
var { nanoid } = require("nanoid");
const { groupBy, map, keys, add, replace } = require("lodash");

const title_reg = /第[\W\d]+节/,
  start_reg = /\[%[\w\-]{10}%\]/,
  end_reg = /\[\$[\w\-]{10}\$\]/,
  split_reg_0 = /([^\[]*)(\[\$[\w\-]{10}\$\])?([^\[]*)(\[%[\w\-]{10}%\])?(\S*)/,
  writing_split_reg_0 =
    /([^\[]*)(\[\$\s*[\w\-]{32}\s*\$\])?([^\[]*)(\[%\s*[\w\-]{32}\s*%\])?(\S*)/,
  split_reg_1 = /([^\[]*)(\[%[\w\-]{10}%\])?([^\[]*)(\[\$[\w\-]{10}\$\])?(\S*)/,
  writing_split_reg_1 =
    /([^\[]*)(\[%\s*[\w\-]{32}\s*%\])?([^\[]*)(\[\$\s*[\w\-]{32}\s*\$\])?(\S*)/;

/* 审核m-html预处理 */
router.post("/audit", function ({ body }, res, next) {
  if (!body.html || !body.errors) {
    return res.json({
      success: false,
      reason: "缺少html或error列表",
    });
  }
  let { html, errors } = body;
  let start_ts = new Date().getTime();
  let error_map = errors.reduce((pre, cur) => {
    return {
      ...pre,
      [cur.err_id]: cur,
    };
  }, {});
  let group_error = {};
  errors.forEach((err) => {
    let k = err.block_index + err.context + err.catalog_idx;
    if (!group_error[k]) group_error[k] = [];
    group_error[k].push(err);
  });

  const $ = cheerio.load(html);

  let sections = $("body").children();

  const result = [
    {
      title: "前言",
      html: "",
    },
  ];

  $("a").each((i, el) => {
    $(el).attr("href", "javascript:void(0)");
  });

  // 第二个版本，根据title_reg来判断
  sections.each((idx, section) => {
    let $section = $(section),
      tts = $section.find("p.MsoTitle, h1, p.a9"),
      classname = $section.attr("class");

    // console.log(tts.length);
    if (tts.length === 1) {
      let $t = $(tts[0]),
        sec_text = $section.text(),
        title = $t.text().trim(),
        ele_html = $section.wrap("<div></div>").parent().html();

      if (!title || !title_reg.test(title)) {
        result[result.length - 1].html += ele_html;
      } else {
        let sec = {
          title: $t.text(),
          html: ele_html,
          classname,
        };
        result.push(sec);
      }
      $section.unwrap();
    }
    if (tts.length === 0) {
      result[result.length - 1].html += $section
        .wrap("<div></div>")
        .parent()
        .html();
    }
    // 如果标题数量大于1，测需要特殊处理
    if (tts.length > 1) {
      let prevcontent = tts.eq(0).prevAll();
      // 处理标题之前的内容
      if (prevcontent.length) {
        prevcontent = $section.children().eq(0).nextUntil(tts.eq(0));

        let clone = $section.clone().empty(),
          str = $section.children().eq(0).wrap("div").html();
        $section.children().eq(0).unwrap();
        prevcontent.each((nidx, pre) => {
          str += $(pre).wrap("<div></div>").parent().html();
          $(pre).unwrap();
        });
        clone.append(str);
        clone.wrap("<div>");
        result[result.length - 1].html += clone.parent().html();
        clone.unwrap();
      }
      // 开始处理标题以及标题与标题之间的内容
      tts.each(function (idx, ts) {
        let clone = $section.clone().empty(),
          title = $(ts).text().trim(),
          str = $(ts).wrap("<div></div>").parent().html();
        $(ts).unwrap();
        let nus = $(ts).nextUntil(tts.get(idx+1));
        nus.each((nidx, nu) => {
          str += $(nu).wrap("<div></div>").parent().html();
          $(nu).unwrap();
        });
        clone.append(str);

        if (!title || !title_reg.test(title)) {
          clone.wrap("<div />");
          result[result.length - 1].html += clone.parent().html();
        } else {
          let sec = {
            title,
            html: clone.wrap("<div/>").parent().html(),
            classname,
          };
          result.push(sec);
        }
      });
    }
  });

  if (!result[0].html) {
    result.shift();
  }

  // 把mark-html转换为带有id的span标签的html
  result.forEach((ret, i) => {
    ret.html = reduceAuditMarkHtml(ret.html, i, error_map, group_error);
  });

  let ret = {
    success: true,
    result,
    duration: (new Date().getTime() - start_ts) / 1000 + "s",
    errors, // 给error添加了catalog_index
  };
  res.json(ret);
});

router.post("/writing", function ({ body }, res, next) {
  if (!body.html || !body.errors) {
    return res.json({
      success: false,
      reason: "缺少html或error列表",
    });
  }
  let { html, errors } = body;
  let start_ts = new Date().getTime();
  // 分章节
  let result = {
    html: reduceWritingMarkHtml(html, 0, errors),
  };
  // 把mark-html转换为带有id的span标签的html
  // result.forEach((ret, i) => {
  //   // console.log(ret.html);
  //   ret.html = reduceWritingMarkHtml(ret.html, i, errors);
  // });

  let ret = {
    success: true,
    result,
    duration: (new Date().getTime() - start_ts) / 1000 + "s",
    errors, // 给error添加了catalog_index
  };
  res.json(ret);
});

router.post("/test", (req, res) => {
  console.log(typeof req.query.return_errors);
  res.send("hello from simple server :)");
});

module.exports = router;

function old_reduceAuditMarkHtml(html, catalog_idx, error_map) {
  let $ = cheerio.load(html);
  $("div[class^='WordSection']")
    .children()
    .each((i, child) => {
      let $child = $(child),
        child_html = $child.html(),
        full_text = $child.text(),
        full_text_match = full_text.match(/\[%[\w\-]{10}%\]/g);

      let ids = full_text_match
        ? full_text_match.map((str) => str.slice(2, -2))
        : undefined;

      $child
        .contents()
        .filter(function () {
          return this.nodeType === 3;
        })
        .wrap("<span></span>");
      // 匹配出所有的开始ID
      if (ids) {
        ids.forEach((id) => {
          let child_spans = $child.find("span[lang='EN-US']");
          child_spans.each((j, span) => {
            // 判断标签里的内容是否只有mark start id
            let onlystart = $(span).text().match(geneStartFullReg(id));
            if (onlystart) {
              //   如果只有start id就判断结束标签里是不是只有mark end id
              let containEndSpans = $child.find(
                "span[lang='EN-US']:contains('[$" + id + "$]')"
              );
              //   如果只有mark end id
              if (containEndSpans.text().match(geneEndFullReg(id))) {
                // console.log(onlyendspan.text());
                let eles = $(span)
                  .nextUntil(containEndSpans)
                  .wrapAll(geneContainer(id, error_map));
                containEndSpans.remove();
              } else if (
                containEndSpans.text().match(new RegExp(geneEndReg(id)))
              ) {
                //   否则要判断里面是否有下一个标记的开始ID
                let match_nxt_start = containEndSpans.text().match(split_reg_0);
                let [, pre, endid, mid, startid, suf] = match_nxt_start;
                let container = geneContainer(id, error_map),
                  eles = $(span).nextUntil(containEndSpans);

                if (eles.length) {
                  eles.wrapAll(container);
                  let parent = eles ? eles.eq(0).parent() : null;
                  //   console.log(eles);
                  // console.log(pre, endid, mid, startid, suf);
                  // 需要把前缀放在包裹的最后一个元素 (因为处理的是只有开始id的情况)
                  if (pre) {
                    parent.append(geneSpan(pre));
                  }
                  //   需要把中间/后缀放在包裹后面的一个位置 (因为处理的是只有开始id的情况)
                  if (mid) {
                    parent.after(geneSpan(mid));
                  }
                } else {
                  console.log($(span).html(), containEndSpans.html(), "******");
                }

                // if(!startid) containEndSpans.remove();
                // console.log("****");
                // console.log($(span).nextUntil(containEndSpans).length);
              }
              $(span).remove();
            } else if (
              $(span)
                .text()
                .match(new RegExp(geneStartReg(id)))
            ) {
              // console.log(id);
              let span_text = $(span).text();
              //   console.log(containEndSpans.html(),"containEndSpans");
              //   console.log($(span).text(),"span text");
              // 如果不仅有start id就要判断到底有什么
              // 先判断startid在前面还是endid在前面

              // 如果endid在前面或者没有endid  <span lang="EN-US">[$131yT8WDqH$][%131yT8WDqH%]</span>  <span lang="EN-US">[%131yT8WDqH%]test data</span>

              if (
                (span_text.match(end_reg) && span_text.match(end_reg).index) <
                span_text.match(geneStartReg(id)).index
              ) {
                let containEndSpans = $child.find(
                  "span[lang='EN-US']:contains('[$" + id + "$]')"
                );
                let match_nxt_start = containEndSpans.text().match(split_reg_0);
                let [, pre, endid, mid, startid, suf] = match_nxt_start;
                //   console.log(pre, endid, mid, startid, suf,"***");
                // 要把startid截止到对应endid包裹起来
                let container = geneContainer(id, error_map),
                  eles = $(span).nextUntil(containEndSpans);

                if (eles.length) {
                  eles.wrapAll(container);
                  let parent = eles.eq(0).parent();
                  //   如果没有endid的时候，要把前缀/中间放在包裹前面的一个位置
                  if (!endid && pre) {
                    parent.before(geneSpan(pre));
                  }

                  //   在没有endid且有前缀的情况下要把前缀插入到元素前面
                  if (suf) {
                    parent.prepend(geneSpan(suf));
                  }

                  if (!startid) {
                    containEndSpans.remove();
                  }
                  $(span).remove();
                }
              } else if (!span_text.match(end_reg)) {
                // <span lang="EN-US">[%131yT8WDqH%]136,265,727.10</span>
                let containEndSpans = $child.find(
                  "span[lang='EN-US']:contains('[$" + id + "$]')"
                );
                let match_nxt_start = span_text.match(split_reg_1);
                let [, pre, starid, mid, endid, suf] = match_nxt_start;

                let container = geneContainer(id, error_map),
                  eles = $(span).nextUntil(containEndSpans);

                if (eles.length) {
                  eles.wrapAll(container);
                  let parent = eles.eq(0).parent();
                  //   如果没有endid的时候，要把前缀/中间放在包裹前面的一个位置
                  // parent.before(geneSpan(mid));
                  parent.prepend(geneSpan(mid));
                  containEndSpans.remove();
                  $(span).remove();
                }
              } else {
                // 如果是startid后面紧跟着有endid <span lang="EN-US">[%131yT8WDqH%]136,265,727.10[$131yT8WDqH$]</span>
                let match_nxt_start = span_text.match(split_reg_1);
                let [, pre, starid, mid, endid, suf] = match_nxt_start;
                // console.log(match_nxt_start);

                // console.log(pre, starid, mid, endid, suf);
                $(span).text(pre + mid + suf);
                $(span).wrap(geneContainer(id, error_map));
              }
            }
          });

          if (!$(`#${id}`).parent().hasClass("context")) {
            $(`#${id}`)
              .parent()
              .children()
              .wrapAll(`<span class="context" ></span>`);
          }
          $(`#${id}`).parent().attr(id, "");
          $(`#${id}`)
            .parent()
            .addClass((error_map[id] && error_map[id].err_type) || "unknow");
          // console.log($(`#${id}`).parent());
          //   if (full_text.match(id)) {
          //   }

          // console.log(id);
          error_map[id].catalog_idx = catalog_idx;
        });
      }
      //   console.log(ids);
    });

  // return html;
  // console.log($.html());
  // fs.writeFileSync("./result.html", $.html());
  return $("body").html();
}

function reduceAuditMarkHtml(html, catalog_idx, error_map, group_error) {
  let $ = cheerio.load(html);
  let body = $("body");
  body.children().each((j, child) => {
    $(child)
      .addBack()
      .find("*")
      .filter(function (i, el) {
        return (
          $(el).children().length &&
          $(el).contents().length !== $(el).children().length
        );
      })
      .contents()
      .filter(function () {
        return this.nodeType === 3;
      })
      .wrap("<span></span>");
  });

  let body_text = body.text();

  let matchids = body_text.match(/\[%[\w\-]{10}%\]/g);

  let ids = matchids
    ? matchids.map((str) => str.match(/\[%([\w\-]{10})%\]/)[1])
    : [];

  // console.log(ids);

  ids.forEach((id) => {
    if (error_map[id]) {
      error_map[id].catalog_idx = catalog_idx;
    }
    let child_spans = body.find("span[lang='EN-US']:contains('" + id + "')");
    let start_span = child_spans
      .filter("span[lang='EN-US']:contains('[%')")
      .eq(0);
    let end_span = child_spans
      .filter("span[lang='EN-US']:contains('[$')")
      .eq(0);

    if (!start_span.get(0) || !end_span.get(0)) {
      return;
    }

    // 判断是否是同一层
    if (
      start_span.parents().length === end_span.parents().length &&
      start_span.parent().get(0) === end_span.parent().get(0)
    ) {
      // console.log("同一层");
      // 需要判断是不是属于同一个元素
      if (start_span.get(0) === end_span.get(0)) {
        // 是同一个元素
        let htmlstr = start_span.parent().html();
        htmlstr = replace(
          htmlstr,
          geneStartReg(id, "g"),
          `<span class="${
            (error_map[id] && error_map[id].err_type) || "unknow"
          } error_tag" id=${id} >`
        );
        htmlstr = replace(htmlstr, geneEndReg(id, "g"), `</span>`);
        start_span.parent().html(htmlstr);
      } else {
        // 不是同一个元素
        let eles = start_span.nextUntil(end_span);
        let container = geneContainer(id, error_map);
        eles.wrapAll(container);

        let str_arr = start_span.text().split(geneStartReg(id));

        if (str_arr[1]) {
          eles.eq(0).parent().prepend(`<span>${str_arr[1]}</span>`);
          str_arr[1] = "";
        }
        start_span.text(str_arr.join(""));

        let end_arr = end_span.text().split(geneEndReg(id));
        // console.log(end_arr);
        if (end_arr[0]) {
          eles.eq(0).parent().append(`<span>${end_arr[0]}</span>`);
          end_arr[0] = "";
        }
        end_span.text(end_arr.join(""));
      }
    } else {
      // console.log("不同层");
      let same_parent;
      let start_parents = start_span.parents(),
        end_parents = end_span.parents();

      end_parents.each((i, sparent) => {
        start_parents.each((j, eparent) => {
          if (sparent === eparent && !same_parent) {
            same_parent = $(sparent);
            // console.log("find same parent.");
          }
        });
      });

      let start_span_until = start_span.parentsUntil(same_parent);
      let end_span_until = end_span.parentsUntil(same_parent);
      let need_wrap_0, need_wrap_1, eles;

      if (start_span_until.length > 0) {
        let ids = [],
          part_root = start_span_until.last();
        // console.log(part_root.html());
        // console.log(start_span_until.length);
        start_span_until.each((j, el) => {
          let _id = nanoid(5);
          $(el).attr("id", _id);
          ids.push(_id);
        });
        let clone_el = part_root.clone();
        // console.log(part_root.html());

        ids.forEach((_id, i) => {
          part_root
            .find("#" + _id)
            .nextAll()
            .remove();
          clone_el
            .find("#" + _id)
            .prevAll()
            .remove();

          part_root.find("#" + _id).attr("id", "");
          clone_el.find("#" + _id).attr("id", "");
        });
        // console.log(part_root.html());
        part_root
          .find("span[lang='EN-US']:contains('" + id + "')")
          .nextAll()
          .remove();
        clone_el
          .find("span[lang='EN-US']:contains('" + id + "')")
          .prevAll()
          .remove();
        clone_el.find("span[lang='EN-US']:contains('" + id + "')").remove();
        part_root.after(clone_el);
        need_wrap_0 = clone_el;
      }

      if (end_span_until.length > 0) {
        let ids = [],
          part_root = end_span_until.last();
        end_span_until.each((j, el) => {
          let _id = nanoid(5);
          $(el).attr("id", _id);
          ids.push(_id);
        });
        let clone_el = end_span_until.last().clone();

        ids.forEach((_id, i) => {
          part_root
            .find("#" + _id)
            .nextAll()
            .remove();
          clone_el
            .find("#" + _id)
            .prevAll()
            .remove();
        });
        part_root
          .find("span[lang='EN-US']:contains('" + id + "')")
          .nextAll()
          .remove();
        clone_el
          .find("span[lang='EN-US']:contains('" + id + "')")
          .prevAll()
          .remove();
        clone_el.find("span[lang='EN-US']:contains('" + id + "')").remove();
        part_root.after(clone_el);
        need_wrap_1 = part_root;
      }

      if (need_wrap_0 && need_wrap_1) {
        eles = need_wrap_0
          .nextUntil(need_wrap_1)
          .add(need_wrap_1)
          .add(need_wrap_0);
      } else {
        if (!need_wrap_0 && need_wrap_1) {
          // console.log("!need_wrap_0 && need_wrap_1");
          eles = start_span
            .nextUntil(need_wrap_1)
            .add(need_wrap_1)
            .add(start_span);
        }

        if (need_wrap_0 && !need_wrap_1) {
          eles = end_span
            .addBack()
            .prevUntil(need_wrap_0)
            .add(need_wrap_0)
            .add(end_span);
        }
      }
      eles.wrapAll(geneContainer(id, error_map));
      let container = $("#" + id);
      let str_arr = start_span.text().split(geneStartReg(id));

      if (str_arr[1]) {
        container.prepend(`<span>${str_arr[1]}</span>`);
        str_arr[1] = "";
      }
      start_span.text(str_arr.join(""));
      container.before(start_span);

      let end_arr = end_span.text().split(geneEndReg(id));
      // console.log(end_arr);
      if (end_arr[0]) {
        container.append(`<span>${end_arr[0]}</span>`);
        end_arr[0] = "";
      }
      end_span.text(end_arr.join(""));
      container.after(end_span);
      // console.log(need_wrap_0.html());
    }
  });

  $("span[lang='EN-US']").filter((idx, el) => {
    if (!$(el).text()) $(el).remove();
  });
  $("p[id]").filter((idx, el) => {
    if (!$(el).text()) $(el).remove();
  });

  //
  Object.keys(group_error).forEach((key, i) => {
    let ids = group_error[key].map((v) => v.err_id);
    let min_len = Infinity,
      min_len_id = 0;
    ids.forEach((id) => {
      let len = $(`#${id}`).parents().length;
      if (len < min_len) {
        min_len = len;
        min_len_id = id;
      }
    });
    $(`#${min_len_id}`)
      .parent()
      .children()
      .wrapAll(`<span ${ids.join(" ")} class="context" ></span>`);
    let parent = $(`#${min_len_id}`).parent();
    ids.forEach((id, j) => {
      parent.attr(id, "");
      parent.addClass((error_map[id] && error_map[id].err_type) || "unknow");
    });
  });

  return $("body").html();
}

function reduceWritingMarkHtml(html, catalog_idx, error_map) {
  let $ = cheerio.load(html);
  let body = $("body");
  body.children().each((j, child) => {
    $(child)
      .addBack()
      .find("*")
      .filter(function (i, el) {
        return (
          $(el).children().length &&
          $(el).contents().length !== $(el).children().length
        );
      })
      .contents()
      .filter(function () {
        return this.nodeType === 3;
      })
      .wrap("<span></span>");
  });

  let body_text = body.text();

  let matchids = body_text.match(/\[%\s*[\w]{32}\s*%\]/g);

  let ids = matchids
    ? matchids.map((str) => str.match(/\[%\s*([\w]{32})\s*%\]/)[1])
    : [];

  ids.forEach((id) => {
    let child_spans = body.find("span[lang='EN-US']:contains('" + id + "')");
    let start_span = child_spans
      .filter("span[lang='EN-US']:contains('[%')")
      .eq(0);
    let end_span = child_spans
      .filter("span[lang='EN-US']:contains('[$')")
      .eq(0);
    if (!start_span.get(0) || !end_span.get(0)) {
      return;
    }
    // 判断是否是同一层
    if (
      start_span.parents().length === end_span.parents().length &&
      start_span.parent().get(0) === end_span.parent().get(0)
    ) {
      // console.log("同一层");
      // 需要判断是不是属于同一个元素
      if (start_span.get(0) === end_span.get(0)) {
        // 是同一个元素
        let htmlstr = start_span.parent().html();
        htmlstr = replace(
          htmlstr,
          geneWritingStartReg(id, "g"),
          `<span id=${id} >`
        );
        htmlstr = replace(htmlstr, geneWritingEndReg(id, "g"), `</span>`);
        start_span.parent().html(htmlstr);
      } else {
        // 不是同一个元素
        let eles = start_span.nextUntil(end_span);
        let container = geneContainer(id, error_map);
        eles.wrapAll(container);

        let str_arr = start_span.text().split(geneWritingStartReg(id));

        if (str_arr[1]) {
          eles.eq(0).parent().prepend(`<span>${str_arr[1]}</span>`);
          str_arr[1] = "";
        }
        start_span.text(str_arr.join(""));

        let end_arr = end_span.text().split(geneWritingEndReg(id));
        // console.log(end_arr);
        if (end_arr[0]) {
          eles.eq(0).parent().append(`<span>${end_arr[0]}</span>`);
          end_arr[0] = "";
        }
        end_span.text(end_arr.join(""));
      }
    } else {
      // console.log("不同层");
      let same_parent;
      let start_parents = start_span.parents(),
        end_parents = end_span.parents();

      end_parents.each((i, sparent) => {
        start_parents.each((j, eparent) => {
          if (sparent === eparent && !same_parent) {
            same_parent = $(sparent);
            // console.log("find same parent.");
          }
        });
      });

      let start_span_until = start_span.parentsUntil(same_parent);
      let end_span_until = end_span.parentsUntil(same_parent);
      let need_wrap_0, need_wrap_1, eles;

      if (start_span_until.length > 0) {
        let ids = [],
          part_root = start_span_until.last();
        // console.log(part_root.html());
        // console.log(start_span_until.length);
        start_span_until.each((j, el) => {
          let _id = nanoid(5);
          $(el).attr("id", _id);
          ids.push(_id);
        });
        let clone_el = part_root.clone();
        // console.log(part_root.html());

        ids.forEach((_id, i) => {
          part_root
            .find("#" + _id)
            .nextAll()
            .remove();
          clone_el
            .find("#" + _id)
            .prevAll()
            .remove();

          part_root.find("#" + _id).attr("id", "");
          clone_el.find("#" + _id).attr("id", "");
        });
        // console.log(part_root.html());
        part_root
          .find("span[lang='EN-US']:contains('" + id + "')")
          .nextAll()
          .remove();
        clone_el
          .find("span[lang='EN-US']:contains('" + id + "')")
          .prevAll()
          .remove();
        clone_el.find("span[lang='EN-US']:contains('" + id + "')").remove();
        part_root.after(clone_el);
        need_wrap_0 = clone_el;
      }

      if (end_span_until.length > 0) {
        let ids = [],
          part_root = end_span_until.last();
        end_span_until.each((j, el) => {
          let _id = nanoid(5);
          $(el).attr("id", _id);
          ids.push(_id);
        });
        let clone_el = end_span_until.last().clone();

        ids.forEach((_id, i) => {
          part_root
            .find("#" + _id)
            .nextAll()
            .remove();
          clone_el
            .find("#" + _id)
            .prevAll()
            .remove();
        });
        part_root
          .find("span[lang='EN-US']:contains('" + id + "')")
          .nextAll()
          .remove();
        clone_el
          .find("span[lang='EN-US']:contains('" + id + "')")
          .prevAll()
          .remove();
        clone_el.find("span[lang='EN-US']:contains('" + id + "')").remove();
        part_root.after(clone_el);
        need_wrap_1 = part_root;
      }

      if (need_wrap_0 && need_wrap_1) {
        eles = need_wrap_0
          .nextUntil(need_wrap_1)
          .add(need_wrap_1)
          .add(need_wrap_0);
      } else {
        if (!need_wrap_0 && need_wrap_1) {
          // console.log("!need_wrap_0 && need_wrap_1");
          eles = start_span
            .nextUntil(need_wrap_1)
            .add(need_wrap_1)
            .add(start_span);
        }

        if (need_wrap_0 && !need_wrap_1) {
          eles = end_span
            .addBack()
            .prevUntil(need_wrap_0)
            .add(need_wrap_0)
            .add(end_span);
        }
      }
      eles.wrapAll(geneContainer(id, error_map));
      let container = $("#" + id);
      let str_arr = start_span.text().split(geneWritingStartReg(id));

      if (str_arr[1]) {
        container.prepend(`<span>${str_arr[1]}</span>`);
        str_arr[1] = "";
      }
      start_span.text(str_arr.join(""));
      container.before(start_span);

      let end_arr = end_span.text().split(geneWritingEndReg(id));
      // console.log(end_arr);
      if (end_arr[0]) {
        container.append(`<span>${end_arr[0]}</span>`);
        end_arr[0] = "";
      }
      end_span.text(end_arr.join(""));
      container.after(end_span);
      // console.log(need_wrap_0.html());
    }
  });

  $("span[lang='EN-US']").filter((idx, el) => {
    if (!$(el).text()) $(el).remove();
  });
  $("p[id]").filter((idx, el) => {
    if (!$(el).text()) $(el).remove();
  });
  return $("body").html();
}

function geneStartReg(id, g) {
  return new RegExp("\\[%" + id + "%\\]", g);
}

function geneEndReg(id, g) {
  return new RegExp("\\[\\$" + id + "\\$\\]", g);
}

function geneStartFullReg(id, g) {
  return new RegExp("^\\[%" + id + "%\\]$", g);
}

function geneEndFullReg(id, g) {
  return new RegExp("^\\[\\$" + id + "\\$\\]$", g);
}

function geneWritingStartReg(id, g) {
  return new RegExp("\\[%\\s*" + id + "\\s*%\\]", g);
}

function geneWritingEndReg(id, g) {
  return new RegExp("\\[\\$\\s*" + id + "\\s*\\$\\]", g);
}

function geneWritingStartFullReg(id, g) {
  return new RegExp("^\\[%\\s*" + id + "\\s*%\\]$", g);
}

function geneWritingEndFullReg(id, g) {
  return new RegExp("^\\[\\$\\s*" + id + "\\s*\\$\\]$", g);
}

function geneContainer(id, error_map) {
  // console.log(error_map[id]);
  let classes = [
    (error_map[id] && error_map[id].err_type) || "unknow",
    "error_tag",
  ];
  return `<span id=${id} class="${classes.join(" ")}" ></span>`;
}

function geneSpan(text) {
  return `<span >${text}</span>`;
}
