import {
  Component,
  OnInit,
  Inject,
  ViewChild,
  ViewChildren,
  ElementRef,
  HostListener,
  Input,
  Output,
  ViewEncapsulation,
  EventEmitter,
  SimpleChanges
} from '@angular/core';
import { Router } from '@angular/router';
import { Http } from '@angular/http';
import { DomSanitizer } from '@angular/platform-browser';
import { MatSidenav, MatIconRegistry } from '@angular/material';
import { Observable } from 'rxjs/Observable';
import { startWith } from 'rxjs/operators/startWith';
import { map } from 'rxjs/operators/map';
import { FormControl } from '@angular/forms';
import 'rxjs/Rx';

import { LayoutService } from "../../shared/services/layout.service";

//sdk



import * as kbsdk from '../../kb-sdk';
var KBLoopbackConfig = kbsdk.LoopBackConfig;

import { Disease, Drug, Symptom } from '../../kb-sdk/models';
import { DiseaseApi, DrugApi, SymptomApi, GraphApi } from '../../kb-sdk/services';
import { kbManagerUrl } from "../../environment";
import {
  DrugNode,
  SymptomNode,
  DiagnosisNode,
  DiseaseNode,
  ObservationItemNode,
  ItemCriterionNode,
  BodyPartNode,
  ContextNode,
  TreatmentNode,
  PatientGuidanceNode,
  DeviceNode,
  LabTestNode,
  MedicalExaminationNode
} from "../model";

import * as _ from "underscore";
import * as shape from 'd3-shape';
declare var window;
var d3 = require("d3");

@Component({
  selector: 'graph-component',

  providers: [
  ],
  styleUrls: ['./graph.component.css'],
  templateUrl: './graph.component.html'
})
export class GraphComponent implements OnInit {
  @Input() viewHeight: number = 0;
  @Input() viewWidth: number = 0;
  @Input() nodes: any[];
  @Input() links: any[];
  @Input() trigger: number;
  @Output() saveNode: EventEmitter<any> = new EventEmitter<string>();
  @Output() saveLink: EventEmitter<any> = new EventEmitter<string>();
  @ViewChild('graphSvg') private graphSvg: ElementRef;
  @ViewChild('svgG') private svgG: ElementRef;
  @ViewChild('dragLine') private dragLine: ElementRef;
  @ViewChild('d3Graph') private d3Graph: ElementRef;
  @ViewChild('minimap') private minimap: ElementRef;
  @ViewChild('minimapRect') private minimapRect: ElementRef;
  @ViewChild('miniNodes') private miniNodes: ElementRef;
  @ViewChild('minimapFrame') private minimapFrame: ElementRef;
  @ViewChild('snav') private snav: MatSidenav;
  // @ViewChild('parentContainer') private parentContainer: ElementRef;
  private _svg: any;
  private _svgG: any;
  private _minimap: any;
  private _minimapRect: any;
  private _miniNodes: any;
  private _minimapFrame: any;
  private _pathsG: any;
  private _nodesG: any;
  private _dragLine: any;
  private _rects: any;
  private _paths: any;
  public singleData: any = {};
  public editType: string;
  public nodesList: any[];
  public colorPlate: any[];
  public formType: string;
  public formModel: any;
  constructor(
    private router: Router,
    private diseaseApi: DiseaseApi,
    private drugApi: DrugApi,
    private symptomApi: SymptomApi,
    private graphApi: GraphApi,
    private http: Http,
    private layoutApi: LayoutService,
    iconRegistry: MatIconRegistry,
    sanitizer: DomSanitizer
  ) {

    iconRegistry.addSvgIcon(
      'layout',
      sanitizer.bypassSecurityTrustResourceUrl('assets/img/layout.svg'));



    this.colorPlate = [
      '#fed500', //症状
      '#f5cedb', //疾病
      '#8ee9d4', //药物
      '#b4e876', //处置
      '#b4e876', //患者指导
      '#ffd191', //观察项
      '#ffd191', //观察项标准
      '#ffd191', //检验
      '#ffd191', //检查
      '#dcd4f7', //诊断
      '#dcd4f7', //器件
      '#dcd4f7', //人体部位
      '#dcd4f7', //其它因素
      '#efcef3', //
      '#e2d2f4', //
      '#dcd4f7', //
    ]
    /**
     * [
      '#c8daf4', 
      '#d1d7f4', 
      '#c2dbf4', 
      '#a0e3f0',
      '#8ee9d4',
      '#89eda0',
      '#b4e876',
      '#fed500',
      '#ffd191',
      '#fdcfad',
      '#f8d0c3',
      '#fccec7',
      '#f5cedb',
      '#efcef3',
      '#e2d2f4',
      '#dcd4f7',
    ]
     */

    this.nodesList = [
      { name: "症状", type: "Symptom", color: 0 },
      { name: "疾病", type: "Disease", color: 1 },
      { name: "药物", type: "Drug", color: 2 },
      { name: "处置", type: "Treatment", color: 3 },
      { name: "患者指导", type: "PatientGuidance", color: 4 },
      { name: "观察项", type: "ObservationItem", color: 5 },
      { name: "观察项标准", type: "ItemCriterion", color: 6 },
      { name: "检验", type: "LabTest", color: 7 },
      { name: "检查", type: "MedicalExamination", color: 8 },
      { name: "诊断", type: "Diagnosis", color: 9 },
      { name: "器件", type: "Device", color: 10 },
      { name: "人体部位", type: "BodyPart", color: 11 },
      { name: "其他因素", type: "Context", color: 12 },
    ]



  }

  private _state = {
    selectedNode: null,
    selectedEdge: null,
    mouseDownNode: null,
    mouseUpNode: null,
    mouseDownLink: null,
    justDragged: false,
    justScaleTransGraph: false,
    lastKeyDown: -1,
    dragDraw: false,
    selectedText: null,
    reloadDate: false,
    minimapTransform: {
      x: 0,
      y: 0,
      k: 1
    },
    minimapInital: true,
    isInited: true,
    recycle: false
  }

  private _CONST = {
    selectedClass: "selected",
    connectClass: "connect-node",
    circleGClass: "conceptG",
    graphClass: "graph",
    activeEditId: "active-editing",
    BACKSPACE_KEY: 8,
    DELETE_KEY: 46,
    ENTER_KEY: 13,
    nodeWidth: 120,
    nodeHeight: 30,
    toolbarIconWidth: 20,
    toolbarIconHeight: 20,
    minimapScale: 1,
    miniZoom: null,
    dragSvg: null,
    shiftKey: false,
    svgWidth: null,
    svgHeight: null,
    viewWidth: null,
    viewHeight: null,
    xAxisLength: null,
    yAxisLength: null,
    minimapWidth: null,
    minimapHeight: null
  }


  private _getWidth(el: ElementRef) {
    return parseInt(window.getComputedStyle(el.nativeElement).width)
  }

  private _getHeight(el: ElementRef) {
    return parseInt(window.getComputedStyle(el.nativeElement).height)
  }

  private _calPanWidth(el: ElementRef, multiple: number) {
    return this._getWidth(el) * multiple
  }
  private _calPanHeight(el: ElementRef, multiple: number) {
    return this._getHeight(el) * multiple
  }

  public setBgc(param) {
    let index: number;
    if (typeof param === 'string') {
      index = this.nodesList.findIndex(node => {
        // console.log(node, param);
        return node.type === param;
      })

    } else {
      index = param
    }
    return this.colorPlate[index];
  }

  ngOnInit() {
    let thisGraph = this, isLayouted = true;
    this.nodes.forEach(node => {
      if (!node.x || !node.y) {
        isLayouted = false;
      }
    })

    this._svg = d3.select(this.graphSvg.nativeElement);
    this._svgG = d3.select(this.svgG.nativeElement);
    this._dragLine = d3.select(this.dragLine.nativeElement);
    this._minimap = d3.select(this.minimap.nativeElement);
    this._minimapRect = d3.select(this.minimapRect.nativeElement);
    this._miniNodes = d3.select(this.miniNodes.nativeElement);
    this._minimapFrame = d3.select(this.minimapFrame.nativeElement);


    this.resize();
    this.graphEventInit();

    //append brush
    this._svgG.append("g")
      .attr("class", "brush")
      .call(d3.brush()
        .extent([
          [0, 0],
          [thisGraph._CONST.viewWidth * 10, thisGraph._CONST.viewHeight * 10]
        ])
        .on("start", function () {
          thisGraph.brushStart.call(thisGraph)
        })
        .on("brush", function () {
          thisGraph.brushed.call(thisGraph)
        })
        .on("end", function () {
          thisGraph.brushEnd.call(thisGraph)
        })
      )
    this._pathsG = this._svgG.append("g").attr("id", "pathG");
    this._nodesG = this._svgG.append("g").attr("id", "nodeG");
    if (!isLayouted) {
      this.layout();
    } else {
      this.updateGraph();
    }

  }
  ngAfterViewInit() {

    this.resize();
    // window.dispatchEvent(new Event('resize'));
  }
  ngOnChanges(changes: SimpleChanges) {

    if (changes['trigger'] && !changes['trigger'].firstChange) {
      this.updateGraph();
    }

  }


  //resize svg
  private resize() {
    let viewWidth = this._getWidth(this.d3Graph),
      viewHeight = this._getHeight(this.d3Graph),
      panWidth = this._calPanWidth(this.d3Graph, 2),
      panHeight = this._calPanHeight(this.d3Graph, 2),
      thisGraph = this;
    this._CONST = Object.assign({}, this._CONST, {
      svgWidth: panWidth,
      svgHeight: panHeight,
      viewWidth: viewWidth,
      viewHeight: viewHeight,
      xAxisLength: -panWidth,
      yAxisLength: -panHeight,
      minimapWidth: panWidth / 10,
      minimapHeight: panHeight / 10,
      minimapScale: 10,
    })


    //init minimap zoom event at first time



    this._svg
      .attr("width", this._CONST.svgWidth)
      .attr("height", this._CONST.svgHeight)

    if (this._CONST.miniZoom) {
      this.frameInit();
    }
  }


  //update graph 
  private updateGraph() {

    let thisGraph = this;
    console.log(this.links, this.nodes);

    this._paths = this._pathsG.selectAll("path.link").data(this.links);
    this._rects = this._nodesG.selectAll("g.conceptG").data(this.nodes);
    //remove old links and nodes
    this._paths.exit().remove();
    this._rects.exit().remove();


    this._paths.enter().append("path")
      .style('marker-end', 'url(#end-arrow)')
      .classed("link", true)
      .attr("id", function (d) {
        return d.id
      })
      .merge(this._paths)
      .attr("d", function (d, index) {
        let sourceNode, targetNode, sourceX,
          sourceY, targetX, targetY;
        sourceNode = thisGraph.nodes.filter(node => node.id == d.from)[0]
        targetNode = thisGraph.nodes.filter(node => node.id == d.to)[0]
        console.log(sourceNode, targetNode);

        if (sourceNode && targetNode) {
          let sourceX = parseInt(sourceNode.x) + thisGraph._CONST.nodeWidth / 2,
            sourceY = parseInt(sourceNode.y) + thisGraph._CONST.nodeHeight / 2,
            targetX = parseInt(targetNode.x) + thisGraph._CONST.nodeWidth / 2,
            targetY = parseInt(targetNode.y) + thisGraph._CONST.nodeHeight / 2,
            xdifference = sourceX - targetX,
            ydifference = sourceY - targetY,
            absXdifference = Math.abs(xdifference),
            absYdifference = Math.abs(ydifference);
          if (xdifference > 0) {
            if (absYdifference / absXdifference < 0.5) {
              targetX += thisGraph._CONST.nodeWidth / 2;
              sourceX -= thisGraph._CONST.nodeWidth / 2;
            } else if (ydifference > 0) {
              targetY += thisGraph._CONST.nodeHeight / 2;
              sourceY -= thisGraph._CONST.nodeHeight / 2;

            } else {
              targetY -= thisGraph._CONST.nodeHeight / 2;
              sourceY += thisGraph._CONST.nodeHeight / 2;
            }
          } else {
            if (absYdifference / absXdifference < 0.5) {
              targetX -= thisGraph._CONST.nodeWidth / 2;
              sourceX += thisGraph._CONST.nodeWidth / 2;
            } else if (ydifference > 0) {
              targetY += thisGraph._CONST.nodeHeight / 2;
              sourceY -= thisGraph._CONST.nodeHeight / 2;
            } else {
              targetY -= thisGraph._CONST.nodeHeight / 2;
              sourceY += thisGraph._CONST.nodeHeight / 2;
            }
          }

          return "M" + sourceX + "," + sourceY + "L" + targetX + "," + targetY;
        }
      })
      .on("click", function (data) {
        console.log(data);
        thisGraph.formType = data.type;
        thisGraph.singleData = data;
        thisGraph.snav.open();
      })


    //enter and append new node g
    let newGs = this._rects.enter().append("g")
      .classed(this._CONST.circleGClass, true)

      .on("mousedown", function (d) {
        thisGraph.nodeMouseDown.call(thisGraph, d3.select(this), d);
      })
      .on("mouseenter", function (d) {
        thisGraph._state.mouseUpNode = d;
        thisGraph.showToolbar.call(thisGraph, d3.select(this), d)
      })
      .on("mouseleave", function (d) {
        thisGraph._state.mouseUpNode = null;
        thisGraph.hideToolbar.call(thisGraph, d3.select(this), d)
      })
      .call(this._CONST.dragSvg)
      .each(function (data, index) {
        thisGraph.insertToolbar(d3.select(this));
      });

    //new g append new rect
    newGs.append("rect")
      .attr("width", thisGraph._CONST.nodeWidth)
      .attr("height", thisGraph._CONST.nodeHeight)
      .append("title")
      .text(function (d) {
        return d.name;
      })

    //update all node name
    newGs.merge(this._rects)
      .style("fill", function (data) {

        return thisGraph.setBgc(data.type)
      })
      .attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
      })
      .each(function (data, index) {

        thisGraph.insertTitleLinebreaks(d3.select(this), data.name);
      })
      .select("g.toolbar rect")
      .style("fill", function (data) {
        return thisGraph.setBgc(data.type)
      })


    this.minimapNodes();

  }

  //get element transform
  private getTransform(selection) {
    var thisGraph = this;
    // var baseTransform = thisGraph.svgG.node().transform.baseVal,
    var baseTransform = Array.from(selection.node().transform.baseVal),
      transformObj: any = {};

    if (baseTransform.length > 0) {
      baseTransform.forEach((e: any, i) => {
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
      })
    }
    transformObj.x = transformObj.x || 0;
    transformObj.y = transformObj.y || 0;
    transformObj.scale = transformObj.scale || 1;
    return transformObj;
  }

  //minimap frame init
  private frameInit() {
    this._minimap
      .attr("width", this._CONST.minimapWidth)
      .attr("height", this._CONST.minimapHeight)

    this._minimapRect
      .attr("width", this._CONST.minimapWidth)
      .attr("height", this._CONST.minimapHeight)

    this._minimapFrame
      .select("rect")
      .attr("width", this._CONST.viewWidth / this._CONST.minimapScale)
      .attr("height", this._CONST.viewHeight / this._CONST.minimapScale)

    this._minimap.call(this._CONST.miniZoom).on("wheel", (e) => { e.preventDefault() });
  }

  //minimap node
  private minimapNodes() {
    let mininodes = this._miniNodes.selectAll("g").data(this.nodes), thisGraph = this;
    mininodes.exit().remove();
    mininodes.enter().append("g")
      .attr("transform", function (d) {
        return "translate(" + d.x / thisGraph._CONST.minimapScale + "," + d.y / thisGraph._CONST.minimapScale + ")" + " scale(" + (1 / thisGraph._CONST.minimapScale) + ")";
      })
      .append("rect")
      .attr("width", this._CONST.nodeWidth)
      .attr("height", this._CONST.nodeHeight)
    mininodes.attr("transform", function (d) {
      return "translate(" + d.x / thisGraph._CONST.minimapScale + "," + d.y / thisGraph._CONST.minimapScale + ")" + " scale(" + (1 / thisGraph._CONST.minimapScale) + ")";
    })

    // .attr("transform", "scale(" + (this._CONST.minimapWidth / this._CONST.svgWidth) + ")")

  }


  //drag and zoom event
  private graphEventInit() {
    let thisGraph = this;
    this._CONST.miniZoom = d3.zoom()
      .scaleExtent([1, 2])
      .on("start", function () {
        thisGraph._minimap.style("cursor", "move")

        if (thisGraph._state.minimapInital) {
          d3.event.transform.x = thisGraph._state.minimapTransform.x;
          d3.event.transform.y = thisGraph._state.minimapTransform.y;
          d3.event.transform.k = thisGraph._state.minimapTransform.k;
          thisGraph._state.minimapInital = false;
        }

        // console.log();

      })
      .on("zoom", function () { // limitX miniframe
        let transform = d3.event.transform,
          // frameTranslate = d3.zoomTransform(thisGraph._minimapFrame.node()),
          frameTranslate = thisGraph.getTransform(thisGraph._minimapFrame),
          consts = thisGraph._CONST,
          // limitX = consts.minimapWidth * (1 - frameTranslate.scale / 2),
          limitX = consts.minimapWidth - consts.viewWidth / consts.minimapScale * frameTranslate.scale,
          limitY = consts.minimapHeight - consts.viewHeight / consts.minimapScale * frameTranslate.scale,
          x = Math.max(0, Math.min(limitX, transform.x)),
          y = Math.max(0, Math.min(limitY, transform.y)),
          svgX = -x / frameTranslate.scale * consts.minimapScale,
          svgY = -y / frameTranslate.scale * consts.minimapScale,
          svgScale = frameTranslate.scale / Math.pow(frameTranslate.scale, 2);

        thisGraph._state.minimapTransform = transform;


        thisGraph._minimapFrame
          .attr("transform", "translate(" + [x, y] + ") scale(" + transform.k + ")")
        d3.event.transform.x = x;
        d3.event.transform.y = y;
        thisGraph._svgG
          .attr("transform", "translate(" + [svgX, svgY] + ") scale(" + svgScale + ")")
      })

    this._CONST.dragSvg = d3.drag()
      .subject(function (d) {
        return {
          x: d.x,
          y: d.y
        };
      })
      .on("drag", function (datum) {
        thisGraph._state.justDragged = true;
        let e = d3.event,
          d3GraphOffset = thisGraph.getOffset(thisGraph.d3Graph.nativeElement),
          containerLeft = d3GraphOffset.left + 10,
          containerTop = d3GraphOffset.top + 10,
          nodeEle = d3.select(this).node(),
          elementOffset = thisGraph.getOffset(nodeEle),
          elementLeft = elementOffset.left,
          elementTop = elementOffset.top,
          consts = thisGraph._CONST,
          transform = thisGraph._state.minimapTransform,
          frameTranslate = thisGraph.getTransform(thisGraph._minimapFrame),
          // limitX = consts.minimapWidth * (1 - frameTranslate.scale / 2),
          limitX = consts.minimapWidth - consts.viewWidth / consts.minimapScale * transform.k,
          limitY = consts.minimapHeight - consts.viewHeight / consts.minimapScale * frameTranslate.scale,
          x, y, svgX, svgY,
          svgScale = frameTranslate.scale / Math.pow(frameTranslate.scale, 2);
        if ((elementLeft <= containerLeft || elementLeft + consts.nodeWidth >= containerLeft + consts.viewWidth) && transform) {

          x = Math.max(0, Math.min(limitX, (transform.x = transform.x - (elementLeft <= containerLeft ? 3 : -3))));

          y = transform.y;
          svgX = -x / frameTranslate.scale * consts.minimapScale;
          svgY = -y / frameTranslate.scale * consts.minimapScale;


          d3.select("#minimapFrame")
            .attr("transform", "translate(" + [x, y] + ") scale(" + transform.k + ")")
          transform.x = x;
          transform.y = y;

          d3.select(".graph")
            .attr("transform", "translate(" + [svgX, svgY] + ") scale(" + svgScale + ")")
        }

        if ((elementTop <= containerTop || elementTop + consts.nodeHeight >= containerTop + consts.viewHeight) && transform) {

          y = Math.max(0, Math.min(limitY, (transform.y = transform.y - (elementTop <= containerTop ? 3 : -3))));
          x = transform.x;
          svgX = -x / frameTranslate.scale * consts.minimapScale;
          svgY = -y / frameTranslate.scale * consts.minimapScale;
          d3.select("#minimapFrame")
            .attr("transform", "translate(" + [x, y] + ") scale(" + transform.k + ")")
          transform.x = x;
          transform.y = y;
          d3.select(".graph")
            .attr("transform", "translate(" + [svgX, svgY] + ") scale(" + svgScale + ")")
        }

        if (thisGraph._state.dragDraw) {
          thisGraph._dragLine.attr('d', 'M' + (datum.x + 60) + ',' + (datum.y + 30) + 'L' + d3.mouse(thisGraph._svgG.node())[0] + ',' + d3.mouse(thisGraph._svgG.node())[1]);
        } else {
          d3.selectAll("g.conceptG").filter(function (single) {
            return single.selected;
          })
            .attr("transform", function (d) {
              d.x += d3.event.dx;
              d.y += d3.event.dy;
              let e = thisGraph.getTransform(thisGraph._svgG);
              if (d.x > (-thisGraph._CONST.xAxisLength - thisGraph._CONST.nodeWidth)) {
                d.x = (-thisGraph._CONST.xAxisLength - thisGraph._CONST.nodeWidth)
              }
              if (d.x < 0) {
                d.x = 0
              }
              if (d.y > (-thisGraph._CONST.yAxisLength - thisGraph._CONST.nodeHeight)) {
                d.y = -thisGraph._CONST.yAxisLength - thisGraph._CONST.nodeHeight
              }
              if (d.y < 0) {
                d.y = 0
              }
              return "translate(" + [d.x, d.y] + ")"
            });
          d3.selectAll("path.link")
            .filter(function (link) {

              if (link) {
                let sourceNode = thisGraph.nodes.filter(node => node.id == link.from)[0],
                  targetNode = thisGraph.nodes.filter(node => node.id == link.to)[0];
                return (sourceNode) || (targetNode);
              }
            })
            .attr("d", function (current) {

              // if (current.name || current.repeat.length > 0) {

              //   let currentScale = thisGraph.getTransform(thisGraph.svgG).scale;
              //   let halfPosition = this.getPointAtLength(this.getTotalLength() / 2);
              //   let textTag = $("#text_" + current.id);
              //   let x = halfPosition.x - ($(textTag).width() + thisGraph._CONST.nodeWidth / 2) * currentScale / 2;
              //   textTag.attr({
              //     x: halfPosition.x,
              //     y: halfPosition.y - 5
              //   })
              // }
              // if (current.from === current.to) {
              //   var node = underscore.find(thisGraph.nodes, function (node) {
              //     return node.id === current.from;
              //   })
              //   var startPoint = [
              //     node.x + thisGraph.consts.nodeWidth + 5,
              //     node.y + thisGraph.consts.nodeHeight / 2 - 10
              //   ]
              //   var points = [
              //     startPoint, [startPoint[0] + 20, startPoint[1] + 10],
              //     [startPoint[0], startPoint[1] + 20]
              //   ];

              //   return d3.line()
              //     .curve(d3.curveCardinal)(points);
              // }

              let sourceNode, targetNode, sourceX,
                sourceY, targetX, targetY;
              sourceNode = thisGraph.nodes.filter(node => node.id == current.from)[0];
              targetNode = thisGraph.nodes.filter(node => node.id == current.to)[0];

              if (sourceNode && targetNode) {
                let sourceX = parseInt(sourceNode.x) + thisGraph._CONST.nodeWidth / 2,
                  sourceY = parseInt(sourceNode.y) + thisGraph._CONST.nodeHeight / 2,
                  targetX = parseInt(targetNode.x) + thisGraph._CONST.nodeWidth / 2,
                  targetY = parseInt(targetNode.y) + thisGraph._CONST.nodeHeight / 2,
                  xdifference = sourceX - targetX,
                  ydifference = sourceY - targetY,
                  absXdifference = Math.abs(xdifference),
                  absYdifference = Math.abs(ydifference);
                if (xdifference > 0) {
                  if (absYdifference / absXdifference < 0.5) {
                    targetX += thisGraph._CONST.nodeWidth / 2;
                    sourceX -= thisGraph._CONST.nodeWidth / 2;
                  } else if (ydifference > 0) {
                    targetY += thisGraph._CONST.nodeHeight / 2;
                    sourceY -= thisGraph._CONST.nodeHeight / 2;

                  } else {
                    targetY -= thisGraph._CONST.nodeHeight / 2;
                    sourceY += thisGraph._CONST.nodeHeight / 2;
                  }
                } else {
                  if (absYdifference / absXdifference < 0.5) {
                    targetX -= thisGraph._CONST.nodeWidth / 2;
                    sourceX += thisGraph._CONST.nodeWidth / 2;
                  } else if (ydifference > 0) {
                    targetY += thisGraph._CONST.nodeHeight / 2;
                    sourceY -= thisGraph._CONST.nodeHeight / 2;
                  } else {
                    targetY -= thisGraph._CONST.nodeHeight / 2;
                    sourceY += thisGraph._CONST.nodeHeight / 2;
                  }
                }

                return "M" + sourceX + "," + sourceY + "L" + targetX + "," + targetY;
              }

            })
        }
      })
      .on("end", function (d) {
        let updatenodes = d3.selectAll("g.conceptG").filter(function (datum) {
          return datum.selected == true;
        }).data()

        thisGraph._dragLine.classed("hidden", true);
        thisGraph.minimapNodes();
        // let series = [];
        if (thisGraph._state.dragDraw && thisGraph._state.mouseUpNode && thisGraph._state.mouseDownNode.id !== thisGraph._state.mouseUpNode) {
          thisGraph.nodeMouseUp.call(thisGraph, d3.select(this), d);
        } else {
          //update node position
          thisGraph._state.dragDraw = false;
        }


      });
  }


  private nodeMouseUp(d3node, d) {
    let mouseDownNode = this._state.mouseDownNode,
      mouseUpNode = this._state.mouseUpNode;

    this._dragLine.classed("hidden", true);
    if (!mouseDownNode) return this._state.dragDraw = false;
    if (mouseUpNode && this._state.dragDraw) {

      if (mouseUpNode.id === mouseDownNode.id) return;
      let newLink = {
        id: new Date().getTime(),
        from: mouseDownNode.id,
        to: mouseUpNode.id,
        type: "Relationship"
      }

      let tmpConflickLink = this.links.filter(link => {
        return link.to === newLink.from && link.from === newLink.to
      })

      if (tmpConflickLink.length > 0) return this._state.dragDraw = false;



      this.links.push(newLink);
      console.log(this.links);

      this.updateGraph();
    }

    this._state.dragDraw = false
  }


  private nodeMouseDown(d3node, d) {
    d3.event.stopPropagation()
    this._state.mouseDownNode = d;

    if (!d.selected) {
      d3.selectAll("g.conceptG").classed("selected", function (p) {
        return p.selected = d.id === p.id;
      })
    }
  }


  private insertTitleLinebreaks(d3El, title) {
    var words = [],
      thisGraph = this,
      nwords, textEle, str1;
    if (title.length > 12) {
      str1 = title.substring(0, 10) + "...";
      // let str2 = title.length > 16 ? title.substring(8, 16) + "..." : title.substring(8)
      words.push(str1)
    } else {
      str1 = title
      words.push(str1)
    }
    nwords = words.length;
    textEle = d3El.select("text");
    if (!textEle.empty() && textEle.text() === str1) return;
    if (!textEle.empty() && textEle.text() !== str1) textEle.remove();

    var el = d3El.append("text")
      .attr("text-anchor", "middle")
      // .attr("dx",(nwords - 1) * 50)
      // .attr("dy",-(nwords - 1) * 30)
      .attr("dy", "-" + (nwords - 1) * 7.5)
      .style("fill", "#000");

    for (var i = 0; i < words.length; i++) {
      var tspan = el
        .append('tspan')
        .text(words[i])
        .attr("x", thisGraph._CONST.nodeWidth / 2)
        // .attr("y", words.length >= 2 ? thisGraph._CONST.nodeHeight / 10 * 5 : thisGraph._CONST.nodeHeight / 10 * 5 + 10);
        .attr("y", 20);
      if (i > 0)
        tspan.attr('dy', '15');
    }
  }


  private insertToolbar(selection) {
    let toolbarEle = selection.select('g.toolbar').size(), thisGraph = this;

    if (!toolbarEle) {
      // console.log(selection.data()[0]);

      let g = selection.append('g')
        .classed('toolbar', true)
        .attr("x", -50)
        .attr("y", 0)
        .style("opacity", 0)
      g.append('rect')
        .attr('width', thisGraph._CONST.nodeWidth)
        .attr('height', 30)
        .attr("x", 0)
        .attr("y", thisGraph._CONST.nodeHeight)
        .style("fill", function (data) {
          return thisGraph.setBgc(data.type)
        })
        .on("mousedown", function () {
          d3.event.stopPropagation();
        })

      //delete icon
      g.append("svg:image")
        .attr("xlink:href", "assets/img/remove-trash_32.svg")
        .attr("width", thisGraph._CONST.toolbarIconWidth)
        .attr("height", thisGraph._CONST.toolbarIconHeight)
        .attr("class", "deleteNode")
        .attr("x", 0)
        .attr("y", thisGraph._CONST.nodeHeight + 5)
        .on("mousedown", function () {
          d3.event.stopPropagation();
        })
        .on("click", function (d) {
          let data = d3.select(this.parentNode.parentNode).data()[0];
          thisGraph.toolbarDelete.call(thisGraph, d3.select(this), data)
        })

      //edit icon
      g.append("svg:image")
        .attr("xlink:href", "assets/img/edit.svg")
        .attr("width", thisGraph._CONST.toolbarIconWidth)
        .attr("height", thisGraph._CONST.toolbarIconHeight)
        .attr("class", "deleteNode")
        .attr("x", thisGraph._CONST.nodeWidth - 25)
        .attr("y", thisGraph._CONST.nodeHeight + 5)
        .on("mousedown", function () {
          d3.event.stopPropagation();
        })
        .on("click", function (d) {
          let data = d3.select(this.parentNode.parentNode).data()[0];

          // thisGraph.openPanel.emit();
          thisGraph.toolbarEdit.call(thisGraph, d3.select(this), data)
        })
      //link icon
      g.append("svg:image")
        .attr("xlink:href", "assets/img/flow_32.svg")
        .attr("width", thisGraph._CONST.toolbarIconWidth)
        .attr("height", thisGraph._CONST.toolbarIconHeight)
        .attr("class", "deleteNode")
        .attr("x", 25)
        .attr("y", thisGraph._CONST.nodeHeight + 5)
        .on("mousedown", function (d) {
          let data = d3.select(this.parentNode.parentNode).data()[0];
          thisGraph.toolbarDraw.call(thisGraph, d3.select(this), data)
        })



    }
  }

  private showToolbar(selection, data) {
    selection.select("g.toolbar")
      .transition()
      .delay(0)
      .duration(500)
      .style("opacity", "1")
  }

  private hideToolbar(selection, data) {
    selection.select("g.toolbar")
      .transition()
      .delay(0)
      .duration(500)
      .style("opacity", "0")
  }

  private toolbarEdit(selection, data) {

    // this.singleData = Object.assign({}, data);
    this.singleData = data;
    this.formType = this.singleData.type;
    // this.formModel = this.singleData;
    // console.log(this.formModel );
    this.snav.open()

  }

  private toolbarDelete(selection, data) {
    let i = this.nodes.findIndex(node => node.id === data.id), thisGraph = this,
      toSpliceLinks = this.links.filter(link => link.to === data.id || link.from === data.id);

    this.links = _.without(thisGraph.links, ...toSpliceLinks)
    this.saveLink.emit({
      data: this.links
    })
    if (i >= 0) this.nodes.splice(i, 1);

    this.updateGraph();

  }

  private toolbarDraw(selection, data) {

    this._state.dragDraw = true;
    this._dragLine.classed('hidden', false)
      .attr('d', 'M' + (data.x + 60) + ',' + (data.y + 30) + 'L' + (data.x + 60) + ',' + (data.y + 30));
  }

  //brush event
  brushStart = function () {
    let thisGraph = this;
    if (d3.event.sourceEvent.type !== "end") {
      d3.selectAll("g.conceptG").classed("selected", function (d) {
        return d.selected = false;
      })
    }
    // d3.selectAll("path.link").classed(thisGraph.consts.selectedClass, false)
  }

  brushed = function () {
    if (d3.event.sourceEvent.type !== "end") {
      console.log('2222');
      let selection: any[] = d3.event.selection,
        x1: any = selection[0][0],
        x2: any = selection[1][0],
        y1: any = selection[0][1],
        y2: any = selection[1][1];
      d3.selectAll("g.conceptG").classed("selected", function (d: { x: number, y: number, selected: any, previouslySelected: any }) {
        return d.selected = (selection != null && x1 <= d.x && d.x < x2 && y1 <= d.y && d.y < y2)
      });
    }
  }

  brushEnd = function () {
    if (d3.event.selection != null) {
      d3.select("g.brush").call(d3.event.target.move, null);
    }
  }




  //CRUD
  addNode(e) {

    let nativeEvent = e.nativeEvent,
      nodeType = e.dragData.type;

    // let node = new DiseaseNode("", "", "", "", "");
    // console.log(node);

    this.nodes.push({
      id: new Number(this.nodes.length).valueOf() + 1,
      name: "node" + (new Number(this.nodes.length).valueOf() + 1),
      x: nativeEvent.layerX - this._CONST.nodeWidth / 2,
      y: nativeEvent.layerY - this._CONST.nodeHeight / 2,
      type: e.dragData.type
    })

    this.updateGraph();

  }

  save() {
    this.saveNode.emit();
    // this.singleData = Object.assign({});
    this.snav.close()
  }


  closingNav() {

  }

  layout() {
    this.layoutApi.layout(this.nodes, this.links)
      .subscribe(result => {
        this.nodes = result.nodes;
        this.links = result.links;
        this.updateGraph();
      })
  }













  //get offset left
  private getOffset(element): { left: number, top: number } {
    if (!element.getClientRects().length) {
      return { top: 0, left: 0 };
    }
    let rect = element.getBoundingClientRect(),
      win = element.ownerDocument.defaultView;
    return {
      top: rect.top + win.pageYOffset,
      left: rect.left + win.pageXOffset
    };
  }


}

