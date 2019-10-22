import React, { Component } from "react";
import PropTypes from "prop-types";

import * as d3 from "d3";
import "./graphview.scss";
import { isFunction } from "lodash";
const MIN_HEIGHT = 400;
const MIN_WIDTH = 800;
const NODE_WIDTH = 120,
  NODE_HEIGHT = 60,
  toolbarIconWidth = 20,
  toolbarIconHeight = 20,
  NODE_COLOR = "#fff",
  NODE_BORDER_COLOR = "#3d70b2",
  NODE_BORDER_WIDTH = "1px";
let nodeKey = "name",
  sourceKey = "source_node",
  targetKey = "destination_node",
  rectGClass = "conceptG";
class GraphViewComponent extends Component {
  state = {};

  _actionState = {
    minimapInital: true,
    minimapTransform: {
      x: 0,
      y: 0,
      k: 1
    },
    mouseDownNode: null,
    dragDraw: false,
    mouseUpNode: null
  };

  init = props => {
    let { height, width } = props;
    this._setDimensions(height, width);
    this._setContainerOffset();
    this._pandWidth = this._width * 3;
    this._pandHeight = this._height * 3;
    this._minimapScale = 15;
    this._minimapWidth = this._pandWidth / this._minimapScale;
    this._minimapHeight = this._pandHeight / this._minimapScale;

    // set graph height and width
    this.graph_svg
      .attr("width", this._pandWidth)
      .attr("height", this._pandHeight);

    // set minimap height and width
    this.minimap_svg
      .attr("width", this._minimapWidth)
      .attr("height", this._minimapHeight);
    this.minimap_g
      .select("rect")
      .attr("width", this._minimapWidth)
      .attr("height", this._minimapHeight);
    this.minimap_frame
      .select("rect")
      .attr("width", this._width / this._minimapScale)
      .attr("height", this._height / this._minimapScale);
    // init minimap zoom event
    this._setMinimapZoom();
    this._setRectDrag();
    // bind zoom event
    this.minimap_svg.call(this._minimapZoom);

    // brush event
    let { _brushStart, _brushed, _brushEnd } = this;
    this._brshG = this.graph_g
      .append("g")
      .attr("class", "brush")
      .call(
        d3
          .brush()
          .extent([[0, 0], [this._width * 10, this._height * 10]])
          .on("start", _brushStart)
          .on("brush", _brushed)
          .on("end", _brushEnd)
      );

    // append node and link g
    this._pathsG = this.graph_g.append("g").attr("id", "pathG");
    this._nodesG = this.graph_g.append("g").attr("id", "nodeG");
  };
  componentDidMount() {
    this.init(this.props);
    this.updateGraph(this.props);
  }

  componentWillUpdate(nextprops) {
    // return false
    if (
      JSON.stringify(this.props.nodes) !== JSON.stringify(nextprops.nodes) ||
      JSON.stringify(this.props.links) !== JSON.stringify(nextprops.links)
    ) {
      this.updateGraph(nextprops);
    }
  }
  updateGraph = props => {
    let {
      _insertToolbar,
      _insertTitleLinebreaks,
      _nodeMouseDow,
      _actionState,
      _showToolbar,
      _hideToolbar,
      _rectDrag,
      _pandWidth,
      _pandHeight
    } = this;
    this._paths = this._pathsG.selectAll("path.link").data(props.links);
    this._rects = this._nodesG.selectAll("g.conceptG").data(props.nodes);
    this._paths.exit().remove();
    this._rects.exit().remove();

    this._paths
      .enter()
      .append("g")
      .append("path")
      .style("marker-end", "url(#end-arrow)")
      .classed("link", true)
      .attr("id", function(d) {
        return d[sourceKey];
      })
      .merge(this._paths)
      .transition()
      .duration(300)
      .attr("d", (d, index) => {
        return this._genetatePath(d, props);
      });
    /* .attr("", function(d, index) {
        thisGraph.updateLinkName(d, index, thisGraph, this);
      }); */

    let newGs = this._rects
      .enter()
      .append("g")
      .classed(rectGClass, true)

      .on("mousedown", function(d) {
        _nodeMouseDow(d3.select(this), d);
      })
      .on("mouseenter", function(d) {
        _actionState.mouseUpNode = d;
        _showToolbar(d3.select(this), d);
      })
      .on("mouseleave", function(d) {
        _actionState.mouseUpNode = null;
        _hideToolbar(d3.select(this), d);
      })
      .on("dblclick", function(d) {})
      .call(_rectDrag);
    // .each(function(data, index) {});

    newGs
      .append("rect")
      .attr("width", NODE_WIDTH)
      .attr("height", NODE_HEIGHT)
      .append("title");

    let allrects = newGs
      .attr("transform", function(d) {
        if (!d.x || !d.y) {
          d.x = 0;
          d.y = 0;
        }
        return "translate(" + d.x + "," + d.y + ")";
      })
      .merge(this._rects)
      .transition()
      .duration(300)
      .attr("transform", function(d) {
        if (!d.x || !d.y) {
          d.x = 0;
          d.y = 0;
        }
        if (d.x > _pandWidth - NODE_WIDTH) {
          d.x = _pandWidth - NODE_WIDTH;
        }
        if (d.x < 0) {
          d.x = 0;
        }
        if (d.y > _pandHeight - NODE_HEIGHT) {
          d.y = _pandHeight - NODE_HEIGHT;
        }
        if (d.y < 0) {
          d.y = 0;
        }
        return "translate(" + d.x + "," + d.y + ")";
      })
      .each(function(data, index) {
        _insertToolbar(d3.select(this), data);
        // let name = data.name.split(/^\[\S+\]\s/).pop();
        _insertTitleLinebreaks(d3.select(this), data[nodeKey]);
      });
    /*  allrects.select("g.toolbar rect")
      .style("fill", function (data) {
        return thisGraph.setBgc(data.entity_type)
      }) */
    allrects.select("title").text(function(d) {
      return d[nodeKey];
    });

    setTimeout(this._minimapNodes, 0);
  };

  // set width and height of the graph
  _setDimensions(height, width) {
    console.log(this.graph_svg.node().parentNode);
    const {
      offsetHeight: parentHeight,
      offsetWidth: parentWidth
    } = this.graph_svg.node().parentNode;
    this._height = height || parentHeight;
    this._width = width || parentWidth;
    if (typeof this._height !== "number" || this._height < MIN_HEIGHT) {
      console.warn(
        `Invalid/small height provided, falling back to minimum value of ${MIN_HEIGHT}`
      );
      this._height = MIN_HEIGHT;
    }
    if (typeof this._width !== "number" || this._width < MIN_WIDTH) {
      console.warn(
        `Invalid/small width provided, falling back to minimum value of ${MIN_WIDTH}`
      );
      this._width = MIN_WIDTH;
    }
  }

  _setMinimapZoom() {
    let extendNum = this._minimapWidth / (this._width / this._minimapScale);
    this._minimapZoom = d3
      .zoom()
      .on("start", () => {
        // console.log(this._actionState.minimapTransform);
        this.minimap_svg.style("cursor", "move");
        if (this._actionState.minimapInital) {
          d3.event.transform.x = this._actionState.minimapTransform.x;
          d3.event.transform.y = this._actionState.minimapTransform.y;
          d3.event.transform.k = this._actionState.minimapTransform.k;
          this._actionState.minimapInital = false;
        }
      })

      .scaleExtent([1, extendNum])
      .on("zoom", () => {
        let { transform } = d3.event,
          {
            _minimapWidth,
            _width,
            _minimapScale,
            _minimapHeight,
            _height
          } = this;
        let limitX = _minimapWidth - (_width / _minimapScale) * transform.k,
          limitY = _minimapHeight - (_height / _minimapScale) * transform.k,
          x = Math.max(0, Math.min(limitX, transform.x)),
          y = Math.max(0, Math.min(limitY, transform.y)),
          svgX = (-x / transform.k) * _minimapScale,
          svgY = (-y / transform.k) * _minimapScale,
          svgScale = transform.k / Math.pow(transform.k, 2);

        this._actionState.minimapTransform = transform;
        this.minimap_frame.attr(
          "transform",
          "translate(" + [x, y] + ") scale(" + transform.k + ")"
        );
        d3.event.transform.x = x;
        d3.event.transform.y = y;
        this.graph_g.attr(
          "transform",
          "translate(" + [svgX, svgY] + ") scale(" + svgScale + ")"
        );
      })
      .on("end", () => {
        // console.log('end');
      });
  }

  _setRectDrag() {
    let {
      _containerLeft,
      _containerTop,
      _getOffset,
      _minimapWidth,
      _width,
      _height,
      _minimapScale,
      minimap_frame,
      _getTransform,
      _actionState,
      _dragLine,
      graph_g,
      _pandWidth,
      _pandHeight,
      _genetatePath,
      _nodeMouseUp,
      _minimapNodes
    } = this;
    let self = this;
    this._rectDrag = d3
      .drag()
      .subject(function(d) {
        return {
          x: d.x,
          y: d.y
        };
      })
      .on("drag", function(datum) {
        let nodeEle = d3.select(this).node(),
          elementOffset = _getOffset(nodeEle),
          elementLeft = elementOffset.left,
          elementTop = elementOffset.top,
          transform = _actionState.minimapTransform,
          frameTranslate = _getTransform(minimap_frame),
          // limitX = consts.minimapWidth * (1 - frameTranslate.scale / 2),
          limitX = _minimapWidth - (_width / _minimapScale) * transform.k,
          limitY =
            _minimapWidth - (_width / _minimapScale) * frameTranslate.scale,
          x,
          y,
          svgX,
          svgY,
          svgScale = frameTranslate.scale / Math.pow(frameTranslate.scale, 2),
          { nodes, links } = self.props;

        if (
          (elementLeft <= _containerLeft ||
            elementLeft + NODE_WIDTH >= _containerLeft + _width) &&
          transform
        ) {
          x = Math.max(
            0,
            Math.min(
              limitX,
              (transform.x =
                transform.x - (elementLeft <= _containerLeft ? 3 : -3))
            )
          );

          y = transform.y;
          svgX = (-x / frameTranslate.scale) * _minimapScale;
          svgY = (-y / frameTranslate.scale) * _minimapScale;

          d3.select(".minimapFrame").attr(
            "transform",
            "translate(" + [x, y] + ") scale(" + transform.k + ")"
          );
          transform.x = x;
          transform.y = y;

          d3.select(".graph").attr(
            "transform",
            "translate(" + [svgX, svgY] + ") scale(" + svgScale + ")"
          );
        }

        if (
          (elementTop <= _containerTop ||
            elementTop + NODE_HEIGHT >= _containerTop + _height) &&
          transform
        ) {
          y = Math.max(
            0,
            Math.min(
              limitY,
              (transform.y =
                transform.y - (elementTop <= _containerTop ? 3 : -3))
            )
          );
          x = transform.x;
          svgX = (-x / frameTranslate.scale) * _minimapScale;
          svgY = (-y / frameTranslate.scale) * _minimapScale;
          d3.select(".minimapFrame").attr(
            "transform",
            "translate(" + [x, y] + ") scale(" + transform.k + ")"
          );
          transform.x = x;
          transform.y = y;
          d3.select(".graph").attr(
            "transform",
            "translate(" + [svgX, svgY] + ") scale(" + svgScale + ")"
          );
        }

        if (_actionState.dragDraw) {
          _dragLine.attr(
            "d",
            "M" +
              (datum.x + 60) +
              "," +
              (datum.y + 30) +
              "L" +
              d3.mouse(graph_g.node())[0] +
              "," +
              d3.mouse(graph_g.node())[1]
          );
        } else {
          d3.selectAll("g.conceptG")
            .filter(function(single) {
              return single.selected;
            })
            .attr("transform", function(d) {
              d.x += d3.event.dx;
              d.y += d3.event.dy;
              if (d.x > _pandWidth - NODE_WIDTH) {
                d.x = _pandWidth - NODE_WIDTH;
              }
              if (d.x < 0) {
                d.x = 0;
              }
              if (d.y > _pandHeight - NODE_HEIGHT) {
                d.y = _pandHeight - NODE_HEIGHT;
              }
              if (d.y < 0) {
                d.y = 0;
              }
              return "translate(" + [d.x, d.y] + ")";
            });
          d3.selectAll("path.link")
            .filter(function(link) {
              if (link) {
                let sourceNode = nodes.filter(
                    node => node[nodeKey] === link[sourceKey]
                  )[0],
                  targetNode = nodes.filter(
                    node => node[nodeKey] === link[targetKey]
                  )[0];
                return sourceNode || targetNode;
              }
            })
            .attr("d", function(current) {
              return _genetatePath(current, self.props);
            });
          // .attr("", function(d, index) {
          //   thisGraph.updateLinkName(d, index, thisGraph, this);
          // });
        }
      })
      .on("end", function(d) {
        d3.selectAll("g.conceptG")
          .filter(function(datum) {
            return datum.selected == true;
          })
          .data();
        // let series = [];
        if (
          _actionState.dragDraw &&
          _actionState.mouseUpNode &&
          _actionState.mouseDownNode[nodeKey] !==
            _actionState.mouseUpNode[nodeKey]
        ) {
          _nodeMouseUp();
        } else {
          _dragLine.classed("hidden", true);
          _minimapNodes();
          _actionState.dragDraw = false;
        }
      });
  }

  _setContainerOffset = element => {
    let { left, top } = this._getOffset(this.container.node());
    this._containerTop = top + 10;
    this._containerLeft = left + 10;
  };

  _getOffset = element => {
    if (!element.getClientRects().length) {
      return { top: 0, left: 0 };
    }
    let rect = element.getBoundingClientRect(),
      win = element.ownerDocument.defaultView;
    return {
      top: rect.top + win.pageYOffset,
      left: rect.left + win.pageXOffset
    };
  };

  _getTransform(selection) {
    // var baseTransform = thisGraph.svgG.node().transform.baseVal,
    var baseTransform = Array.from(selection.node().transform.baseVal),
      transformObj = {};
    if (baseTransform.length > 0) {
      baseTransform.forEach((e, i) => {
        switch (e.type) {
          case 2:
            transformObj.x = e["matrix"]["e"];
            transformObj.y = e["matrix"]["f"];
            break;
          case 3:
            transformObj.scale = e["matrix"]["a"];
            break;
          default:
            break;
        }
      });
    }
    transformObj.x = transformObj.x || 0;
    transformObj.y = transformObj.y || 0;
    transformObj.scale = transformObj.scale || 1;
    return transformObj;
  }

  _genetatePath = (d, props) => {
    let { nodes, links } = props,
      sourceNode,
      targetNode,
      sourceX,
      sourceY,
      targetX,
      targetY;
    sourceNode = nodes.filter(node => node[nodeKey] === d[sourceKey])[0];
    targetNode = nodes.filter(node => node[nodeKey] === d[targetKey])[0];

    // console.log(sourceNode, targetNode);
    if (sourceNode && targetNode) {
      let sourceX = parseInt(sourceNode.x) + NODE_WIDTH / 2,
        sourceY = parseInt(sourceNode.y) + NODE_HEIGHT / 2,
        targetX = parseInt(targetNode.x) + NODE_WIDTH / 2,
        targetY = parseInt(targetNode.y) + NODE_HEIGHT / 2,
        xdifference = sourceX - targetX,
        ydifference = sourceY - targetY,
        absXdifference = Math.abs(xdifference),
        absYdifference = Math.abs(ydifference);
      if (xdifference > 0) {
        if (absYdifference / absXdifference < 0.5) {
          targetX += NODE_WIDTH / 2;
          sourceX -= NODE_WIDTH / 2;
        } else if (ydifference > 0) {
          targetY += NODE_HEIGHT / 2;
          sourceY -= NODE_HEIGHT / 2;
        } else {
          targetY -= NODE_HEIGHT / 2;
          sourceY += NODE_HEIGHT / 2;
        }
      } else {
        if (absYdifference / absXdifference < 0.5) {
          targetX -= NODE_WIDTH / 2;
          sourceX += NODE_WIDTH / 2;
        } else if (ydifference > 0) {
          targetY += NODE_HEIGHT / 2;
          sourceY -= NODE_HEIGHT / 2;
        } else {
          targetY -= NODE_HEIGHT / 2;
          sourceY += NODE_HEIGHT / 2;
        }
      }

      return (
        "M" +
        (sourceX || 0) +
        "," +
        (sourceY || 0) +
        "L" +
        (targetX || 0) +
        "," +
        (targetY || 0)
      );
    } else {
      return "M0,0 L0,0";
    }
  };

  // insert toolbar
  _insertToolbar = (selection, data) => {
    let hideBtnEle = selection.select("g.hidebtn").size(),
      toolbarEle = selection.select("g.toolbar").size();

    let { _toolbarDraw, _toolbarDelete, _toolbarEdit } = this;

    if (hideBtnEle === 0) {
      /* selection
        .append("g")
        .style("opacity", 0)
        .classed("hidebtn", true)
        .append("svg:image")
        .attr("xlink:href", "assets/img/hide.svg")
        .attr("width", toolbarIconWidth)
        .attr("height", toolbarIconHeight)
        .attr("class", "deleteNode")
        .attr(
          "x",
          NODE_WIDTH - toolbarIconWidth / 2
        )
        // .attr("y", (NODE_HEIGHT - toolbarIconHeight)/2)
        .attr("y", -toolbarIconHeight / 2)
        .on("mousedown", function() {
          d3.event.stopPropagation();
        })
        .on("click", function(d) {
          let data = d3.select(this.parentNode.parentNode).data()[0];
          thisGraph.toolbarDelete.call(thisGraph, d3.select(this), data, true);
        })
        .append("title")
        .text(() => "隐藏"); */
    }

    if (toolbarEle === 0) {
      let g = selection
        .append("g")
        .classed("toolbar", true)
        .attr("x", -50)
        .attr("y", 0)
        .style("opacity", 0);
      g.append("rect")
        .attr("width", NODE_WIDTH)
        .attr("height", 30)
        .attr("x", 0)
        .attr("y", NODE_HEIGHT)
        // .style("fill", () => NODE_COLOR)
        .on("mousedown", function() {
          d3.event.stopPropagation();
        });

      //delete icon
      g.append("svg:image")
        .attr("xlink:href", "/assets/img/remove-trash_32.svg")
        .attr("width", toolbarIconWidth)
        .attr("height", toolbarIconHeight)
        .attr("class", "deleteNode")
        .attr("x", 0)
        .attr("y", NODE_HEIGHT + 5)
        .on("mousedown", function() {
          d3.event.stopPropagation();
        })
        .on("click", function(d) {
          let data = d3.select(this.parentNode.parentNode).data()[0];
          _toolbarDelete(data, true);
        })
        .append("title")
        .text(() => "删除");

      //edit icon
      g.append("svg:image")
        .attr("xlink:href", "/assets/img/edit.svg")
        .attr("width", toolbarIconWidth)
        .attr("height", toolbarIconHeight)
        .attr("class", "deleteNode")
        .attr("x", NODE_WIDTH - 25)
        .attr("y", NODE_HEIGHT + 5)
        .on("mousedown", function() {
          d3.event.stopPropagation();
        })
        .on("click", function(d) {
          let data = d3.select(this.parentNode.parentNode).data()[0];
          _toolbarEdit(data);
          // // thisGraph.openPanel.emit();
          // thisGraph.toolbarEdit.call(thisGraph, d3.select(this), data);
        })
        .append("title")
        .text(() => "编辑");
      //draw link icon
      g.append("svg:image")
        .attr("xlink:href", "/assets/img/flow_32.svg")
        .attr("width", toolbarIconWidth)
        .attr("height", toolbarIconHeight)
        .attr("class", "deleteNode")
        .attr("x", 25)
        .attr("y", NODE_HEIGHT + 5)
        .on("mousedown", function(d) {
          let data = d3.select(this.parentNode.parentNode).data()[0];
          _toolbarDraw(data);
        })
        .append("title")
        .text(() => "增加边");
    }
  };

  _insertTitleLinebreaks = (selection, title) => {
    var words = [],
      nwords,
      textEle,
      str1;
    if (title.length > 10) {
      str1 = title.substring(0, 9) + "..";
      // let str2 = title.length > 16 ? title.substring(8, 16) + "..." : title.substring(8)
      words.push(str1);
    } else {
      str1 = title;
      words.push(str1);
    }
    nwords = words.length;
    textEle = selection.select("text.info");

    if (!textEle.empty() && textEle.text() === str1) return;
    if (!textEle.empty() && textEle.text() !== str1) textEle.remove();

    var el = selection
      .append("text")
      .attr("text-anchor", "middle")
      .classed("info", true)
      // .attr("dx",(nwords - 1) * 50)
      // .attr("dy",-(nwords - 1) * 30)
      .attr("dy", "-" + (nwords - 1) * 7.5);
    // .style("fill", "#000");

    for (var i = 0; i < words.length; i++) {
      var tspan = el
        .append("tspan")
        .text(words[i])
        .attr("x", NODE_WIDTH / 2)
        // .attr("y", words.length >= 2 ? thisGraph._CONST.nodeHeight / 10 * 5 : thisGraph._CONST.nodeHeight / 10 * 5 + 10);
        .attr("y", 20);
      if (i > 0) tspan.attr("dy", "15");
    }
  };

  _nodeMouseDow = (selection, d) => {
    d3.event.stopPropagation();
    // cache mousedown node use to draw link
    this._actionState.mouseDownNode = d;
    if (!d.selected) {
      // add selected class
      d3.selectAll("g.conceptG").classed("selected", function(p) {
        return (p.selected = d[nodeKey] === p[nodeKey]);
      });
    }
  };

  _nodeMouseUp = () => {
    let { mouseDownNode, mouseUpNode } = this._actionState;
    let { nodes, links } = this.props;
    let { addLink } = this.props;
    this._dragLine.classed("hidden", true);
    if (!mouseDownNode) return (this._actionState.dragDraw = false);
    if (mouseUpNode && this._actionState.dragDraw) {
      if (mouseUpNode[nodeKey] === mouseDownNode[nodeKey]) return;
      let newLink = {
        [sourceKey]: mouseDownNode[nodeKey],
        [targetKey]: mouseUpNode[nodeKey],
        id: +new Date()
      };

      let tmpConflickLink = links.filter(link => {
        return (
          link[targetKey] === newLink[sourceKey] &&
          link[sourceKey] === newLink[targetKey]
        );
      });

      if (tmpConflickLink.length > 0)
        return (this._actionState.dragDraw = false);

      if (isFunction(addLink)) {
        addLink(newLink);
      }
      // create new link api
      // this.kbrelationshipApi.create(newLink).subscribe(link => {
      //   this.links.push(link);
      //   this.groupLink();
      //   this.updateGraph();
      // })
    }

    this._actionState.dragDraw = false;
  };

  _showToolbar = (selection, d) => {
    selection
      .selectAll("g")
      .transition()
      .duration(500)
      .style("opacity", "1");
  };

  _hideToolbar = (selection, d) => {
    selection
      .selectAll("g")
      .transition()
      .duration(500)
      .style("opacity", "0");
  };

  _brushStart = () => {
    if (d3.event.sourceEvent.type !== "end") {
      d3.selectAll("g.conceptG").classed("selected", function(d) {
        return (d.selected = false);
      });
    }
  };

  _brushed = function() {
    if (d3.event.sourceEvent.type !== "end") {
      let selection = d3.event.selection,
        x1 = selection[0][0],
        x2 = selection[1][0],
        y1 = selection[0][1],
        y2 = selection[1][1];
      d3.selectAll("g.conceptG").classed("selected", function(d) {
        return (d.selected =
          selection != null && x1 <= d.x && d.x < x2 && y1 <= d.y && d.y < y2);
      });
    }
  };

  _brushEnd = function() {
    if (d3.event.selection != null) {
      d3.select("g.brush").call(d3.event.target.move, null);
    }
  };

  _minimapNodes = () => {
    let mininodes = this.mininodes_g.selectAll("g").data(this.props.nodes);

    let { _minimapScale } = this;
    mininodes.exit().remove();
    mininodes
      .enter()
      .append("g")
      .attr("transform", function(d) {
        return (
          "translate(" +
          d.x / _minimapScale +
          "," +
          d.y / _minimapScale +
          ")" +
          " scale(" +
          1 / _minimapScale +
          ")"
        );
      })
      .append("rect")
      .attr("width", NODE_WIDTH)
      .attr("height", NODE_HEIGHT);
    mininodes.attr("transform", function(d) {
      let x = d.x || 0,
        y = d.y || 0;
      return (
        "translate(" +
        x / _minimapScale +
        "," +
        y / _minimapScale +
        ")" +
        " scale(" +
        1 / _minimapScale +
        ")"
      );
    });
  };

  _calcNodePosition(e) {
    let nativeEvent = e.nativeEvent,
      scale = this._getTransform(this.graph_g).scale,
      miniScale = this._getTransform(this.minimap_frame),
      startX = miniScale.x * this._minimapScale,
      startY = miniScale.y * this._minimapScale;

    let x = (startX + nativeEvent.layerX - (NODE_WIDTH * scale) / 2) / scale,
      y = (startY + nativeEvent.layerY - (NODE_HEIGHT * scale) / 2) / scale;

    return { x, y };
  }

  // toolbar action
  _toolbarDraw = d => {
    this._actionState.dragDraw = true;
    this._dragLine
      .classed("hidden", false)
      .attr(
        "d",
        "M" +
          (d.x + 60) +
          "," +
          (d.y + 30) +
          "L" +
          (d.x + 60) +
          "," +
          (d.y + 30)
      );
  };

  _toolbarDelete = (data, isRealDel) => {
    let { deleteNode } = this.props;
    let toSpliceLinks = this.props.links.filter(
      link =>
        link[targetKey] === data[nodeKey] || link[sourceKey] === data[nodeKey]
    );
    if (isFunction(deleteNode)) {
      deleteNode(data, toSpliceLinks, isRealDel);
    }
  };

  _toolbarEdit = data => {
    let { editAction } = this.props;
    if (isFunction(editAction)) {
      editAction(data);
    }
  };

  render() {
    return (
      <>
        <div
          className="d3Graph"
          ref={container => {
            this.container = d3.select(container);
          }}
        >
          <svg
            className="minimap"
            ref={minimap => {
              this.minimap_svg = d3.select(minimap);
            }}
          >
            <g
              ref={minimap_rect_container => {
                this.minimap_g = d3.select(minimap_rect_container);
              }}
            >
              <rect className="minimapRect" />
            </g>
            <g
              className="miniNodes"
              transform=""
              ref={mininodes_g => {
                this.mininodes_g = d3.select(mininodes_g);
              }}
            />
            <g
              className="minimapFrame"
              ref={minimap_frame => {
                this.minimap_frame = d3.select(minimap_frame);
              }}
            >
              <rect />
            </g>
          </svg>
          <svg
            className="graphContent"
            ref={graphSvg => {
              this.graph_svg = d3.select(graphSvg);
            }}
          >
            <defs>
              <marker
                id="end-arrow"
                viewBox="0 -5 10 10"
                refX="8"
                refY="0"
                markerWidth="3.5"
                markerHeight="3.5"
                orient="auto"
              >
                <path d="M0 -5 L10 0 L0 5" />
              </marker>
            </defs>
            <g
              className="graph"
              ref={graphG => {
                this.graph_g = d3.select(graphG);
              }}
            >
              <path
                className="link dragline hidden"
                d="M0,0L0,0"
                markerEnd="url(#end-arrow)"
                ref={dragLink => {
                  this._dragLine = d3.select(dragLink);
                }}
              />
            </g>
          </svg>
        </div>
      </>
    );
  }
}

GraphViewComponent.propTypes = {
  nodes: PropTypes.array,
  links: PropTypes.array,
  componentWillReceiveProps: PropTypes.array,
  addLink: PropTypes.func,
  deleteNode: PropTypes.func,
  editAction: PropTypes.func
};

export default GraphViewComponent;
