/*=======================================================================
 * IBM Confidential *
 * OCO Source Materials *
 * *
 * (c) Copyright IBM Corp. 2015,2016 *
 * *
 * The source code for this program is not published or otherwise *
 * divested of its trade secrets, irrespective of what has *
 * been deposited with the U.S. Copyright Office. *
 * =====================================================================*/


/*
 * @Author: Hao Chen
 * @Date:   2017-09-22 13:33:49
 * @Last Modified by:   Hao Chen
 * @Last Modified time: 2017-09-22 13:34:21
 */
//http://localhost:5000/api/v1/58aa80b45de4b50d64f57cab/layout
//
//
'use strict';



define(["underscore"], function (underscore) {

    var controller = function ($scope, $mdSidenav, $mdMenu, $mdDialog, $location, $http, $state, $log, Intent, NameEntity, ProcedureDialogV2, ProcedureDialogV2Node, ProcedureDialogV2Link, ScriptFile, DialogRelation) {

        var ace_config = $location.search()["ace_config"];
        if (ace_config) {
            ace_config = JSON.parse(ace_config);
        }
        var service_id = ace_config.id;
        var bot_id = $location.search()["bot"];
        var flowId = $location.search()["flowId"];
        var async = require('async');
        var originatorEv;
        // console.log(flowId);
        CarbonComponents.NumberInput.init();

        CarbonComponents.OverflowMenu.init();
        $scope.message = {
            node: "Node",
            frame: "Frame",
            condition: "Condition",
            conversation: "Conversation",
            end: "End Conversation",
        };
        $scope.singlePath = null;
        $scope.intents = [];
        $scope.selectChildrenID = ""
        $scope.showSlider = function () {
            $("div.editorContent").show("slide", {
                direction: "right"
            }, 500);
        };
        $scope.hideSlider = function () {
            $("div.editorContent").hide("slide", {
                direction: "right"
            }, 500)
        };
        $scope.pathname = "";
        $scope.setSVGheight = function () {
            let toolbarTop = $("#d3Test").offset().top;
            let docHeight = $(document.body).height();
            $scope.viewHeight = docHeight - toolbarTop - 50;
            return {
                // height: $scope.viewHeight + "px"
                height: "650px"
            }
        }
        $scope.toggleNode = function () {
            $mdSidenav("editNode").toggle()
        }
        $scope.closeNode = function () {
            $mdSidenav("editNode").close()
        }
        $scope.toggleLink = function () {
            $mdSidenav("editLinks").toggle();
        }
        $scope.closeLink = function () {
            $mdSidenav("editLinks").close()
        }
        $scope.stopBubble = function (e) {
            e.stopPropagation();
        }
        $scope.scripts = [undefined];
        ScriptFile.find({
            filter: {
                where: {
                    bot_id: bot_id
                }
            }
        }).$promise.then(function (scripts) {
            let ret = underscore.map(scripts, function (v) {
                return v.name.split(".")[0]
            })

            $scope.scripts = $scope.scripts.concat(ret);
            //console.log($scope.scripts);
            // if (!$scope.$$phase) {
            //     $scope.$apply();
            // }
        });

        $scope.openMenu = function ($mdOpenMenu, ev) {
            // console.log($mdOpenMenu);
            originatorEv = ev;
            $mdOpenMenu(ev);
        };

        $scope.addResponse = function (e) {
            if (e.keyCode === 13 && $scope.new_response) {
                $scope.responses.push({
                    text: $scope.new_response
                })
                $scope.new_response = ""
            }
            $("#editNode").mCustomScrollbar("update");
            $("#editNode").mCustomScrollbar("scrollTo", "bottom");
        }
        $scope.checkExistName = function (name, cb) {

            ProcedureDialogV2.find({
                filter: {
                    where: {
                        name: name
                    }
                }
            }).$promise.then(function (dialog) {

                if (dialog.length <= 0 || $scope.procedureName === $scope.singleFlow.flow.name) {
                    cb()
                } else {
                    alert('name is existing');
                }
            })
        }

        $scope.addNewDialog = function (e) {
            if (e.keyCode === 13) {
                $scope.saveOrCreateFlow();
            }
        }
        $scope.saveFlow = function () {
            $scope.checkExistName($scope.procedureName, function () {

                ProcedureDialogV2.updateAttributes({
                    id: flowId
                }, {
                    name: $scope.procedureName
                }).$promise.then(function (flow) {
                    $scope.thisFLow = flow;

                    DialogRelation.updateAttributes({
                        id: $scope.relationDialog.id
                    }, {
                        children: $scope.relationDialog.children,
                        name: $scope.thisFLow.name
                    }).$promise.then(function (relationDialog) {
                        $state.reload()
                    })
                })
            })

            console.log($scope.relationDialog);
        }

        $scope.addExpression = function (e) {
            if (e.keyCode === 13 && $scope.new_expression) {
                $scope.singleLinkExpressions.push($scope.new_expression)
                $scope.new_expression = ""
            }
        }


        $scope.addSet = function () {
            $scope.singleLink.set.push({})
        }

        $scope.deleteResonse = function (index) {
            $scope.responses.splice(index, 1)
        }

        $scope.saveNode = function () {
            let flow = $scope.tabs[0].flow;
            let fk = $scope.singleNode.id;
            let id = flow.id
            let node = $scope.singleNode;
            var thisGraph = $scope.graph;
            if ($scope.responses <= 0) {
                if ($scope.new_response && $scope.new_response.trim()) {
                    node.response[0].text.push($scope.new_response.trim())
                } else {
                    node.response = null;
                }
            } else {
                node.response[0].text = underscore.pluck($scope.responses, "text")
                if ($scope.new_response && $scope.new_response.trim()) {
                    node.response[0].text.push($scope.new_response.trim())
                }
            }

            ProcedureDialogV2Node.updateAttributes({
                id: fk
            }, node).$promise.then(function () {
                ProcedureDialogV2.node.updateById({
                    id: id,
                    fk: fk
                }, node).$promise.then(function (node) {
                    underscore.extend(underscore.findWhere(thisGraph.nodes, {
                        id: node.id
                    }), node);
                    thisGraph.updateGraph();
                    $scope.closeNode()
                })
            })
        }

        $scope.rmCurrentSet = function (index) {
            $scope.singleLink.set.splice(index, 1)
        }

        $scope.saveLink = function () {

            let fk = $scope.singleLink.id,
                condition;

            let singleLink = underscore.omit($scope.singleLink, ["source_node_element", "destination_node_element"]);
            var thisGraph = $scope.graph;
            // if (!$scope.showSet) {
            //     singleLink.set = null
            // }
            if (!$scope.enableLoop) {
                singleLink.loop = null;
            }
            if (!$scope.singleLink.set || $scope.singleLink.set.length <= 0) {
                singleLink.set = null
            }

            if (!$scope.tmp_condition) {
                singleLink.condition = null;
            } else {
                singleLink.condition = {
                    type: "EXPRESSION",
                    expressions: [$scope.tmp_condition]
                }
            }
            ProcedureDialogV2Link.updateAttributes({
                id: fk
            }, singleLink).$promise.then(function () {
                ProcedureDialogV2.link.updateById({
                    id: flowId,
                    fk: fk
                }, singleLink).$promise.then(function (link) {
                    underscore.extend(underscore.findWhere(thisGraph.links, {
                        id: link.id
                    }), link);
                    thisGraph.updateGraph();
                    $scope.closeLink()
                })
            })
        }

        $scope.deleteLink = function () {
            let fk = $scope.singleLink.id;
            console.log("===", $scope.graph.edges.indexOf($scope.singleLink));
            ProcedureDialogV2Link.deleteById({
                id: fk
            }).$promise.then(function () {
                ProcedureDialogV2.link.destroyById({
                    id: flowId,
                    fk: fk
                }, function () {
                    $("#text_" + fk).remove()
                    $scope.graph.edges.splice($scope.graph.edges.indexOf($scope.singleLink), 1);
                    $scope.graph.updateGraph();
                    $scope.closeLink();
                })
            })

        }
        $scope.deleteNode = function () {
            let id = flowId,
                d = $scope.singleNode,
                fk = d.id,
                thisGraph = $scope.graph;
            console.log(d);
            thisGraph.toolbarDelete(thisGraph, d);
            $scope.closeNode();
        }

        $scope.deleteFlow = function () {
            ProcedureDialogV2.deleteById({
                id: flowId
            }).$promise.then(function () {
                $state.go("Bot.AuthoringTool.FlowManagement.DialogAndFlow.showTable", {}, {
                    reload: true
                })
            })
        }

        var tabs, selected = null,
            previous = null;
        // $scope.tabs = tabs;
        $scope.selectedIndex = 0;
        $scope.hideTab = function (tab) {
            tab.show = false;
            var index = tabs.indexOf(tab);
            tabs.splice(index, 1);
        };


        $scope.addTab = function (title, view) {
            tabs.push({
                flow: {
                    name: underscore.uniqueId("dialog_")
                },
                id: underscore.uniqueId("sub_"),
                nodes: [],
                edges: []
            });
        };
        $scope.removeTab = function (tab) {
            if (tabs.length == 1) {

                return alert('this is the only tab !');
            }
            tabs.splice($scope.selectedIndex, 1);
        };

        $scope.editFlow = function (tab) {
            $scope.singleFlow = tab;
            $scope.procedureName = $scope.singleFlow.flow.name;

            $mdSidenav("editFlowName").open()
        }


        $scope.layoutNode = function () {
            ProcedureDialogV2.elkLayout({
                id: flowId,
                viewWidth:$scope.graph.consts.viewWidth
            }).$promise.then(function (dialog) {
                // $state.reload();

                let nodes = dialog.nodes,
                    thisGraph = $scope.graph;

                thisGraph.paths = thisGraph.paths.data(thisGraph.edges);
                thisGraph.rects = thisGraph.rects.data(thisGraph.nodes);
                underscore.each(nodes, function (node) {
                    // console.log(document.getElementById("#" + node.id));
                    let movenode = d3.selectAll("g.conceptG").filter(function (d) {
                        return d.id == node.id
                    })

                    movenode.data()[0].ui_element.x = node.ui_element.x;
                    movenode.data()[0].ui_element.y = node.ui_element.y;
                    movenode.transition()
                        .duration(1000)
                        .attr("transform", "translate(" + [node.ui_element.x, node.ui_element.y] + ")")
                    // $scope.graph.updateGraph();
                })
                d3.selectAll("path.link").each(function (link) {
                    d3.select(this).transition().duration(1000).attr("d", function (d) {
                        if (!d) return;
                        var textnode = thisGraph.isExistText(d.id),
                            sourceNode, targetNode;
                            console.log(textnode);
                        if (textnode) {
                            $("#text_"+d.id).remove();
                        }
                        sourceNode = underscore.find(thisGraph.nodes, function (node) {
                            return node.id === d.source_node_id;
                        })
                        targetNode = underscore.find(thisGraph.nodes, function (node) {
                            return node.id === d.destination_node_id;
                        })
                        if (sourceNode && targetNode) {
                            let sourceX = parseInt(sourceNode.ui_element.x) + thisGraph.consts.nodeWidth / 2,
                                sourceY = parseInt(sourceNode.ui_element.y) + thisGraph.consts.nodeHeight / 2,
                                targetX = parseInt(targetNode.ui_element.x) + thisGraph.consts.nodeWidth / 2,
                                targetY = parseInt(targetNode.ui_element.y) + thisGraph.consts.nodeHeight / 2,
                                xdifference = sourceX - targetX,
                                ydifference = sourceY - targetY,
                                absXdifference = Math.abs(xdifference),
                                absYdifference = Math.abs(ydifference);
                            if (xdifference > 0) {
                                if (absYdifference / absXdifference < 0.5) {
                                    targetX += thisGraph.consts.nodeWidth / 2;
                                    sourceX -= thisGraph.consts.nodeWidth / 2;
                                } else if (ydifference > 0) {
                                    targetY += thisGraph.consts.nodeHeight / 2;
                                    sourceY -= thisGraph.consts.nodeHeight / 2;

                                } else {
                                    targetY -= thisGraph.consts.nodeHeight / 2;
                                    sourceY += thisGraph.consts.nodeHeight / 2;
                                }
                            } else {
                                if (absYdifference / absXdifference < 0.5) {
                                    targetX -= thisGraph.consts.nodeWidth / 2;
                                    sourceX += thisGraph.consts.nodeWidth / 2;
                                } else if (ydifference > 0) {
                                    targetY += thisGraph.consts.nodeHeight / 2;
                                    sourceY -= thisGraph.consts.nodeHeight / 2;
                                } else {
                                    targetY -= thisGraph.consts.nodeHeight / 2;
                                    sourceY += thisGraph.consts.nodeHeight / 2;
                                }
                            }
                            
                            return "M" + sourceX + "," + sourceY + "L" + targetX + "," + targetY;
                        }

                    })
                    .on('end', function (d) {
                        $scope.graph.updateGraph()
                    })
                })

                setTimeout(() => {
                    thisGraph.minimap.call(thisGraph)
                }, 1000);



            })
        }

        $scope.setSelectDialog = function (id) {
            if (!$scope.relationDialog) return true;
            //$scope.relationDialog.children
            if (underscore.isEmpty(underscore.where($scope.relationDialog.children, {
                    dialog_id: id
                }))) {
                return true;
            }
            return false;
        }

        $scope.addChildren = function (id) {
            if (!$scope.relationDialog) {
                throw new Error('no valued relation dialog instance')
            }
            if (!Array.isArray($scope.relationDialog.children)) {
                $scope.relationDialog.children = []
            }

            var selectRelationDialog = underscore.find($scope.dialogsV2, function (dialog) {
                return dialog.id === id
            })
            if (!selectRelationDialog) return;
            $scope.relationDialog.children.push({
                "type": selectRelationDialog.type,
                "dialog_id": id,
                "connected_nodes": underscore.pluck($scope.graph.nodes, "id"),
                "dialog_name": selectRelationDialog.name,
                "bot_id": bot_id
            })


            console.log($scope.relationDialog.children);
        }


        $scope.returnAllnodes = function (dialogID) {
            return underscore.find($scope.dialogsV2, function (dialog) {
                return dialog.id === dialogID
            }).nodes
        }

        $scope.checkNodeChecked = function (child, nodeID) {
            if (!child || !child.connected_nodes) return false;
            var tmp = underscore.find(child.connected_nodes, function (item) {
                return item === nodeID
            });
            if (tmp) {
                return true;
            }
            return false;
        }

        $scope.chageCheckedNode = function ($event, child, nodeID) {
            if (!$event.target.checked) {
                child.connected_nodes = underscore.reject(child.connected_nodes, function (ID) {
                    return ID === nodeID
                })
                console.log($scope.relationDialog.children);
            } else {
                // child.connected_nodes.push()
                var tmpPushNode = underscore.find($scope.graph.nodes, function (tmpNode) {
                    return tmpNode.id === nodeID;
                })

                child.connected_nodes.push(tmpPushNode.id)
                console.log($scope.relationDialog.children);
            }
        }

        $scope.deleteChild = function (id) {
            this.relationDialog.children = underscore.reject(this.relationDialog.children, function (child) {
                return child.id === id
            })
        }

        $scope.$on('$viewContentLoaded', function () {
            $("#editFlowName").mCustomScrollbar({
                theme: "minimal"
            })
            $("#editNode").mCustomScrollbar({
                theme: "minimal"
            })
            $("#editLinks").mCustomScrollbar({
                theme: "minimal"
            })
        })


        NameEntity.find({
            filter: {
                where: {
                    bot_id: bot_id
                }
            }
        }).$promise.then(function (d) {
            $scope.source_name = d;
        })

        Intent.find({
            filter: {
                where: {
                    bot_id: bot_id
                }
            }
        }, function (intents) {
            $scope.intents = intents;
        });

        NameEntity.find({
            filter: {
                where: {
                    bot_id: bot_id
                }
            }
        }, function (entities) {
            $scope.entities = entities;
        });


        ProcedureDialogV2.find({
            filter: {
                where: {
                    bot_id: bot_id
                }
            }
        }).$promise.then(function (dialogs) {
            console.log(dialogs);
            $scope.dialogsV2 = underscore.filter(dialogs, function (dialog) {
                return dialog.id !== flowId
            })
        })




        $(function (d3, $scope, undefined) {
            // construction function
            var GraphCreator = function (svg, nodes, edges) {
                var thisGraph = this;
                thisGraph.idct = 0;
                thisGraph.state = {
                    selectedNode: null,
                    selectedEdge: null,
                    mouseDownNode: null,
                    mouseUpNode: null,
                    mouseDownLink: null,
                    justDragged: false,
                    justScaleTransGraph: false,
                    lastKeyDown: -1,
                    shiftNodeDrag: false,
                    selectedText: null,
                    reloadDate: false,
                    minimapTransform: {
                        x: 0,
                        y: 0,
                        k: 1
                    },
                    minimapInital: true,
                    isInited: true
                };

                //init node position , id ;
                // console.log(tabs);
                $(nodes).each(function (k, v) {
                    if (!v.ui_element) {
                        if (thisGraph.state.isInited) thisGraph.state.isInited = false;
                        v.ui_element = {};
                        v.ui_element.id = v.id;
                        v.ui_element.x = Math.random() * (-thisGraph.consts.xAxisLength - thisGraph.consts.nodeWidth);
                        v.ui_element.y = Math.random() * (-thisGraph.consts.yAxisLength - thisGraph.consts.nodeHeight) + 40;
                    }
                    if (v.ui_element && !v.ui_element.id) {
                        v.ui_element.id = v.id
                    }
                    v.ui_element.selected = false;
                    v.ui_element.previouslySelected = false;
                })
                //console.log(edges);
                $(edges).each(function (k, v) {
                    // console.log(v.ui_element);
                    if (!v.ui_element) {
                        v.ui_element = {
                            id: v.id
                        };
                    }
                    $(nodes).each(function (i, j) {
                        if (j.id === v.source_node_id) {
                            v.source_node_element = j
                        }
                        if (j.id === v.destination_node_id) {
                            v.destination_node_element = j
                        }
                    })
                })
                // console.log(nodes);
                thisGraph.nodes = nodes || [];
                thisGraph.edges = edges || [];

                // console.log(nodes);


                // define arrow markers for graph links
                var defs = svg.append('svg:defs');
                defs.append('svg:marker')
                    .attr('id', 'end-arrow')
                    .attr('viewBox', '0 -5 10 10')
                    .attr('refX', "10")
                    .attr('refY', "0")
                    .attr('markerWidth', 3.5)
                    .attr('markerHeight', 3.5)
                    .attr('orient', 'auto')
                    .append('svg:path')
                    .attr('d', 'M0 -5 L10 0 L0 5');
                /*
                
                var defs = svg.append('svg:defs');
                defs.append('svg:marker')
                    .attr('id', 'end-arrow')
                    // .attr('viewBox', '0 -5 10 10')
                    .attr('refX', "8")
                    .attr('refY', "3")
                    .attr('markerWidth', 10)
                    .attr('markerHeight', 10)
                    .attr('orient', 'auto')
                    .attr('markerUnits', 'strokeWidth')
                    .append('svg:path')
                    .attr('d', 'M0,0 L0,6 L9,3 z');
                */

                thisGraph.svg = svg;

                thisGraph.svgG = svg.append("g")
                    .classed(thisGraph.consts.graphClass, true)
                // .attr("transform", "scale(0.65)");
                var svgG = thisGraph.svgG;

                //rect canvas
                svgG.append("rect")
                    .attr("width", thisGraph.consts.svgWidth)
                    .attr("height", thisGraph.consts.svgHeight)
                    .attr("class", "panRect");

                // displayed when dragging between nodes
                thisGraph.dragLine = svgG.append('svg:path')
                    .attr('class', 'link dragline hidden')
                    .attr('d', 'M0,0L0,0')
                    .style('marker-end', 'url(#mark-end-arrow)');

                // svg nodes and edges 
                //brush 
                svgG.append("g")
                    .attr("class", "brush")
                    .call(d3.brush()
                        .extent([
                            [0, 0],
                            [thisGraph.consts.viewWidth * 10, thisGraph.consts.viewHeight * 10]
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

                thisGraph.paths = svgG.append("g").attr("id", "pathG").selectAll("g");
                thisGraph.rects = svgG.append("g").attr("id", "nodeG").selectAll("g");


                thisGraph.drag = d3.drag()
                    .subject(function (d) {
                        return {
                            x: d.x,
                            y: d.y
                        };
                    })
                    .on("drag", function (datum) {
                        thisGraph.state.justDragged = true;
                        thisGraph.dragmove.call(thisGraph, datum, this);
                    })
                    .on("end", function () {
                        d3.select("body").style("cursor", "auto");
                        let flow = $scope.tabs[0].flow;
                        let id = flow.id;
                        let that = d3.select(this).data()
                        let updatenodes = d3.selectAll("g.conceptG").filter(function (datum) {
                            return datum.ui_element.selected == true;
                        }).data()

                        let series = [];
                        thisGraph.circleMouseup.call(thisGraph, d3.select(this), that);
                        underscore.each(updatenodes, function (node, index) {
                            let fk = node.id;
                            if (!fk) return;
                            series.push(function (callback) {
                                setTimeout(function () {
                                    ProcedureDialogV2.node.updateById({
                                        id: id,
                                        fk: fk
                                    }, node)

                                    callback()
                                }, 100)
                            })

                            ProcedureDialogV2Node.updateAttributes({
                                id: fk
                            }, node).$promise.then(function () {
                                if (index === updatenodes.length - 1) {
                                    async.series(series)
                                }
                            })

                        })



                    });

                // listen for key events
                // d3.select(window).on("keydown", function () {
                //         thisGraph.svgKeyDown.call(thisGraph);
                //     })
                //     .on("keyup", function () {
                //         thisGraph.svgKeyUp.call(thisGraph);
                //     })


                let graphSvg = d3.select()


                GraphCreator.prototype.consts.viewHeight = 650;
                // listen for resize
                // window.onresize = function () {
                //     thisGraph.updateWindow(svg);
                // };
            };

            // static method
            var svgWidth = $("#d3Test").width(),
                panWidth = svgWidth * 6,
                panHeight = svgWidth * 6;
            GraphCreator.prototype.consts = {
                selectedClass: "selected",
                connectClass: "connect-node",
                circleGClass: "conceptG",
                graphClass: "graph",
                activeEditId: "active-editing",
                BACKSPACE_KEY: 8,
                DELETE_KEY: 46,
                ENTER_KEY: 13,
                nodeWidth: 120,
                nodeHeight: 60,
                toolbarIconWidth: 20,
                toolbarIconHeight: 20,
                svgWidth: panWidth,
                svgHeight: panHeight,
                viewWidth: svgWidth,
                viewHeight: 650,
                xAxisLength: -panWidth,
                yAxisLength: -panHeight,
                minimapScale: 20,
                minimapWidth: panWidth / 20,
                minimapHeight: panHeight / 20,
                miniZoom: null,
                dragSvg: null,
                shiftKey: false
            };



            /* PROTOTYPE FUNCTIONS */

            GraphCreator.prototype.dragmove = function (d, element) {
                var thisGraph = this;
                var e = d3.event;
                d3.select("body").style("cursor", "move");
                let containerLeft = $("#d3Test").position().left + 10,
                    containerTop = $("#d3Test").position().top + 10,
                    elementLeft = $(element).offset().left,
                    elementTop = $(element).offset().top,
                    consts = thisGraph.consts,
                    transform = thisGraph.state.minimapTransform,
                    frameTranslate = thisGraph.getTransform(d3.select("#minimapFrame")),
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

                if (thisGraph.state.shiftNodeDrag) {
                    thisGraph.dragLine.attr('d', 'M' + (d.ui_element.x + 60) + ',' + (d.ui_element.y + 30) + 'L' + d3.mouse(thisGraph.svgG.node())[0] + ',' + d3.mouse(this.svgG.node())[1]);
                } else {
                    d3.selectAll("g.conceptG").filter(function (single) {
                            return single.ui_element.selected;
                        })
                        .attr("transform", function (datum) {
                            datum.ui_element.x += d3.event.dx;
                            datum.ui_element.y += d3.event.dy;
                            let e = thisGraph.getTransform(thisGraph.svgG);
                            if (datum.ui_element.x > (-thisGraph.consts.xAxisLength - thisGraph.consts.nodeWidth)) {
                                datum.ui_element.x = (-thisGraph.consts.xAxisLength - thisGraph.consts.nodeWidth)
                            }
                            if (datum.ui_element.x < 0) {
                                datum.ui_element.x = 0
                            }
                            if (datum.ui_element.y > (-thisGraph.consts.yAxisLength - thisGraph.consts.nodeHeight)) {
                                datum.ui_element.y = -thisGraph.consts.yAxisLength - thisGraph.const.nodeHeight
                            }
                            if (datum.ui_element.y < 0) {
                                datum.ui_element.y = 0
                            }
                            return "translate(" + [datum.ui_element.x, datum.ui_element.y] + ")"
                        });
                    d3.selectAll("path.link")
                        .filter(function (link) {

                            if (link) {
                                let sourceNode = underscore.find(thisGraph.nodes, function (node) {
                                        return node.id === link.source_node_id;
                                    }),
                                    targetNode = underscore.find(thisGraph.nodes, function (node) {
                                        return node.id === link.destination_node_id;
                                    })
                                return (sourceNode && sourceNode.ui_element.selected) || (targetNode && targetNode.ui_element.selected);
                            }
                        })
                        .attr("d", function (current) {
                            if (current.name) {

                                let currentScale = thisGraph.getTransform(thisGraph.svgG).scale;
                                let halfPosition = this.getPointAtLength(this.getTotalLength() / 2);
                                let textTag = $("#text_" + current.ui_element.id);
                                let x = halfPosition.x - ($(textTag).width() + thisGraph.consts.nodeWidth / 2) * currentScale / 2;
                                textTag.attr({
                                    x: halfPosition.x,
                                    y: halfPosition.y - 5
                                })
                            }

                            let sourceNode, targetNode, sourceX,
                                sourceY, targetX, targetY;
                            sourceNode = underscore.find(thisGraph.nodes, function (node) {
                                return node.id === current.source_node_id;
                            })
                            targetNode = underscore.find(thisGraph.nodes, function (node) {
                                return node.id === current.destination_node_id;
                            })
                            if (sourceNode && targetNode) {
                                let sourceX = parseInt(sourceNode.ui_element.x) + thisGraph.consts.nodeWidth / 2,
                                    sourceY = parseInt(sourceNode.ui_element.y) + thisGraph.consts.nodeHeight / 2,
                                    targetX = parseInt(targetNode.ui_element.x) + thisGraph.consts.nodeWidth / 2,
                                    targetY = parseInt(targetNode.ui_element.y) + thisGraph.consts.nodeHeight / 2,
                                    xdifference = sourceX - targetX,
                                    ydifference = sourceY - targetY,
                                    absXdifference = Math.abs(xdifference),
                                    absYdifference = Math.abs(ydifference);
                                if (xdifference > 0) {
                                    if (absYdifference / absXdifference < 0.5) {
                                        targetX += thisGraph.consts.nodeWidth / 2;
                                        sourceX -= thisGraph.consts.nodeWidth / 2;
                                    } else if (ydifference > 0) {
                                        targetY += thisGraph.consts.nodeHeight / 2;
                                        sourceY -= thisGraph.consts.nodeHeight / 2;

                                    } else {
                                        targetY -= thisGraph.consts.nodeHeight / 2;
                                        sourceY += thisGraph.consts.nodeHeight / 2;
                                    }
                                } else {
                                    if (absYdifference / absXdifference < 0.5) {
                                        targetX -= thisGraph.consts.nodeWidth / 2;
                                        sourceX += thisGraph.consts.nodeWidth / 2;
                                    } else if (ydifference > 0) {
                                        targetY += thisGraph.consts.nodeHeight / 2;
                                        sourceY -= thisGraph.consts.nodeHeight / 2;
                                    } else {
                                        targetY -= thisGraph.consts.nodeHeight / 2;
                                        sourceY += thisGraph.consts.nodeHeight / 2;
                                    }
                                }

                                return "M" + sourceX + "," + sourceY + "L" + targetX + "," + targetY;
                            }

                        })
                }

            };

            //brush event
            GraphCreator.prototype.brushStart = function () {
                let thisGraph = this;
                if (d3.event.sourceEvent.type !== "end") {
                    d3.selectAll("g.conceptG").classed("selected", function (d) {
                        return d.ui_element.selected = d.ui_element.previouslySelected = thisGraph.consts.shiftKey && d.ui_element.selected;
                    })
                }
                d3.selectAll("path.link").classed(thisGraph.consts.selectedClass, false)
            }

            GraphCreator.prototype.brushed = function () {
                if (d3.event.sourceEvent.type !== "end") {
                    let selection = d3.event.selection;
                    d3.selectAll("g.conceptG").classed("selected", function (d) {
                        return d.ui_element.selected = d.ui_element.previouslySelected ^
                            (selection != null && selection[0][0] <= d.ui_element.x && d.ui_element.x < selection[1][0] &&
                                selection[0][1] <= d.ui_element.y && d.ui_element.y < selection[1][1])
                    });
                }
            }

            GraphCreator.prototype.brushEnd = function () {
                if (d3.event.selection != null) {
                    d3.select("g.brush").call(d3.event.target.move, null);
                }
            }


            /* insert svg line breaks: taken from http://stackoverflow.com/questions/13241475/how-do-i-include-newlines-in-labels-in-d3-charts */
            GraphCreator.prototype.insertTitleLinebreaks = function (gEl, title) {
                var words = [],
                    thisGraph = this,
                    nwords;
                if (title.length > 8) {
                    let str1 = title.substring(0, 8);
                    let str2 = title.length > 16 ? title.substring(8, 16) + "..." : title.substring(8)
                    words.push(str1, str2)
                } else {
                    words.push(title)
                }
                nwords = words.length;
                let nodeType = gEl.data()[0].type;

                var el = gEl.append("text")
                    .attr("text-anchor", "middle")
                    // .attr("dx",(nwords - 1) * 50)
                    // .attr("dy",-(nwords - 1) * 30)
                    .attr("dy", "-" + (nwords - 1) * 7.5);

                for (var i = 0; i < words.length; i++) {
                    if (nodeType === "start") {
                        var tspan = el.append('tspan').text(words[i]).attr("x", "0").attr("y", "0");
                    } else {
                        var tspan = el
                            .append('tspan')
                            .text(words[i])
                            .attr("x", thisGraph.consts.nodeWidth / 2)
                            .attr("y", words.length >= 2 ? thisGraph.consts.nodeHeight / 10 * 5 : thisGraph.consts.nodeHeight / 10 * 5 + 10);
                    }

                    if (i > 0)
                        tspan.attr('dy', '15');
                }
            };

            // add node toolbar

            GraphCreator.prototype.insertToolBar = function (newGs) {
                let thisGraph = this;
                newGs.append("g")
                    .attr("x", -50)
                    .attr("y", 0)
                    .attr("class", "toolbar")
                    .style("opacity", 0)
                newGs.selectAll("g.toolbar").each(function () {
                    let d3g = d3.select(this);
                    let childSize = d3g.selectAll().size();
                    if (!childSize || childSize !== 4) {
                        let tmpRect = d3g.append("rect");
                        tmpRect.attr("width", thisGraph.consts.nodeWidth)
                            .attr("height", 30)
                            .on("mousedown", function () {
                                d3.event.stopPropagation();
                            })


                        //add delete node
                        let tmpDelete = d3g.append("svg:image")
                            .attr("xlink:href", "images/remove-trash_32.svg")
                            .attr("width", thisGraph.consts.toolbarIconWidth)
                            .attr("height", thisGraph.consts.toolbarIconHeight)
                            .attr("class", "deleteNode")
                            .on("mousedown", function () {
                                d3.event.stopPropagation();
                            })
                            .on("click", function (d) {
                                thisGraph.toolbarDelete.call(thisGraph, d3.select(this), d)
                            })
                        //add edit node
                        let tmpEdit = d3g.append("svg:image")
                            .attr("xlink:href", "images/edit_32.svg")
                            .attr("width", thisGraph.consts.toolbarIconWidth)
                            .attr("height", thisGraph.consts.toolbarIconHeight)

                            .attr("class", "editNode")
                            .on("mousedown", function () {
                                d3.event.stopPropagation();
                            })
                            .on("click", function (d) {
                                let id = d.id;

                                let flow = $scope.tabs[0].flow;
                                console.log(flow.nodes, d);

                                $scope.singleNode = d;

                                if (!d.response) {
                                    d.response = [{
                                        text: [],
                                        type: "TEMPLATE_RESPONSE"
                                    }]
                                }

                                if (!d.script) {
                                    $scope.addScript = false;
                                } else {
                                    $scope.addScript = true;
                                }
                                $scope.responses = underscore.map($scope.singleNode.response[0].text, function (value) {
                                    return {
                                        text: value
                                    }
                                })
                                $scope.toggleNode();
                            })
                        //add draw line
                        let tmpDraw = d3g.append("svg:image")
                            .attr("xlink:href", "images/flow_32.svg")
                            .attr("width", thisGraph.consts.toolbarIconWidth)
                            .attr("height", thisGraph.consts.toolbarIconHeight)

                            .attr("class", "drawLine")
                            .on("mousedown", function (d) {
                                thisGraph.toolbarDraw.call(thisGraph, d3.select(this), d)
                                // d3.event.stopPropagation();
                            })


                        if (d3g.data()[0].type === "start") {
                            tmpRect.attr("x", -60)
                                .attr("y", 50);
                            tmpDelete.attr("x", "-58")
                                .attr("y", "0");
                            tmpEdit.attr("x", "35")
                                .attr("y", "0");
                            tmpDraw.attr("x", "-35")
                                .attr("y", "0")

                        } else {
                            tmpRect.attr("x", 0)
                                .attr("y", thisGraph.consts.nodeHeight);
                            tmpDelete.attr("x", "0")
                                .attr("y", thisGraph.consts.nodeHeight + 5);
                            tmpEdit.attr("x", "95")
                                .attr("y", thisGraph.consts.nodeHeight + 5);
                            tmpDraw.attr("x", "30")
                                .attr("y", thisGraph.consts.nodeHeight + 5)
                        }
                    }
                })

            }

            // remove edges associated with a node
            GraphCreator.prototype.spliceLinksForNode = function (node) {
                // console.log(node)
                var thisGraph = this,
                    toSplice = underscore.filter(thisGraph.edges, function (l) {
                        return (l.source_node_element === node || l.destination_node_element === node);
                    })
                return toSplice;
                let texts = d3.select("#pathG").selectAll("text");
                $(toSplice).each(function (i, e) {
                    let id = e.id
                    if (id) {
                        $(texts[0]).each(function (i, e) {
                            if ($(e).attr("pathnodeID") === id) {
                                $(e).remove();
                            }
                        })
                    }
                })

            };

            GraphCreator.prototype.replaceSelectEdge = function (d3Path, edgeData) {
                var thisGraph = this;
                d3Path.classed(thisGraph.consts.selectedClass, true);
                if (thisGraph.state.selectedEdge) {
                    thisGraph.removeSelectFromEdge();
                }
                thisGraph.state.selectedEdge = edgeData;
            };


            GraphCreator.prototype.removeSelectFromNode = function () {
                var thisGraph = this;
                thisGraph.rects.filter(function (cd) {
                    return cd.id === thisGraph.state.selectedNode.id;
                }).classed(thisGraph.consts.selectedClass, false);
                thisGraph.state.selectedNode = null;
            };

            GraphCreator.prototype.removeSelectFromEdge = function () {
                var thisGraph = this;
                thisGraph.paths.filter(function (cd) {
                    return cd === thisGraph.state.selectedEdge;
                }).classed(thisGraph.consts.selectedClass, false);
                thisGraph.state.selectedEdge = null;
            };

            GraphCreator.prototype.pathMouseDown = function (d3path, d) {
                var thisGraph = this,
                    state = thisGraph.state;
                d3.event.stopPropagation();
                state.mouseDownLink = d;

                if (state.selectedNode) {
                    thisGraph.removeSelectFromNode();
                }
                // alert('msg');
                var prevEdge = state.selectedEdge;
                if (!prevEdge || prevEdge !== d) {
                    thisGraph.replaceSelectEdge(d3path, d);
                } else {
                    thisGraph.removeSelectFromEdge();
                }
            };

            // mousedown on node
            GraphCreator.prototype.circleMouseDown = function (d3node, d) {
                var thisGraph = this,
                    state = thisGraph.state;
                d3.event.stopPropagation();
                state.mouseDownNode = d;

                if (thisGraph.consts.shiftKey) {
                    d3node.classed("selected", d.selected = !d.selected)
                    d3.event.stopImmediatePropagation();
                } else if (!d.ui_element.selected) {
                    d3.selectAll("g.conceptG").classed("selected", function (p) {
                        return p.ui_element.selected = d === p;
                    })
                }

            };
            // mouseup on nodes
            GraphCreator.prototype.circleMouseup = function (d3node, d) {
                d = d[0];
                // console.log(d3node).
                var thisGraph = this,
                    state = thisGraph.state,
                    consts = thisGraph.consts;
                // reset the states
                state.shiftNodeDrag = false;
                d3node.classed(consts.connectClass, false);

                let mouseDownNode = state.mouseDownNode;
                let mouseUpNode = state.mouseUpNode;

                if (!mouseDownNode) return;
                // alert('msg');
                thisGraph.dragLine.classed("hidden", true)
                if (mouseUpNode && mouseDownNode !== mouseUpNode) {
                    // we're in a different node: create new edge for mousedown edge and add to graph
                    var newEdge = {
                        source_node_id: mouseDownNode.id,
                        destination_node_id: mouseUpNode.id,
                        ui_element: {},
                        destination_dialog_id: flowId,
                        source_dialog_id: flowId
                    };

                    // filter no useful
                    var filtRes = d3.selectAll("#pathG path.link").filter(function (d) {
                        if (d.source_node_id === newEdge.destination_node_id && d.destination_node_id === newEdge.source_node_id) {
                            thisGraph.edges.splice(thisGraph.edges.indexOf(d), 1);
                        }

                        return d.source_node_id === newEdge.source_node_id && d.destination_node_id === newEdge.destination_node_id;
                    });

                    if (!filtRes.size()) {

                        //storage a new link
                        ProcedureDialogV2Link.create(newEdge).$promise.then(function (link) {

                            let flow = $scope.tabs[$scope.selectedIndex].flow
                            let nodes = flow.nodes;
                            link.ui_element.id = link.id
                            let newLink = underscore.omit(link, ["source_node_element", "destination_node_element"]);
                            // console.log(newLink);
                            ProcedureDialogV2.link.create({
                                id: flowId
                            }, newLink).$promise.then(function (newlink) {
                                thisGraph.edges.push(newlink);

                                underscore.each(nodes, function (item, index) {
                                    if (newlink.source_node_element && newlink.destination_node_element) {
                                        return;
                                    }
                                    if (item.id === newlink.source_node_id) {
                                        newlink.source_node_element = item;
                                        return;
                                    }
                                    if (item.id === newlink.destination_node_id) {
                                        newlink.destination_node_element = item;
                                        return;
                                    }
                                })
                                thisGraph.updateGraph();
                            })

                        })

                    }

                }
                state.mouseDownNode = null;
                thisGraph.minimap();
                return;

            }; // end of rects mouseup
            
            GraphCreator.prototype.isExistText = function (id) {
                return document.getElementById("text_" + id);
            }
            GraphCreator.prototype.showToolbar = function (d3node, d) {
                d3node.select("g.toolbar")
                    .transition()
                    .delay(0)
                    .duration(500)
                    .style("opacity", "1")
            }
            GraphCreator.prototype.hideToolbar = function (d3node, d) {
                d3node.select("g.toolbar")
                    .transition()
                    .delay(0)
                    .duration(500)
                    .style("opacity", "0")
            }

            //toolbar delete
            GraphCreator.prototype.toolbarDelete = function (d3node, d) {
                if (d.type == "start") {
                    return
                }
                let id = flowId,
                    fk = d.id,
                    thisGraph = this;
                ProcedureDialogV2Node.deleteById({
                    id: fk
                }).$promise.then(function () {
                    ProcedureDialogV2.node.destroyById({
                        id: id,
                        fk: fk
                    }, function () {
                        thisGraph.nodes = underscore.without(thisGraph.nodes, d);

                        let toSplice = thisGraph.spliceLinksForNode(d);

                        if (toSplice.length > 0) {
                            underscore.each(toSplice, function (item) {

                                let linkid = item.id;
                                ProcedureDialogV2Link.deleteById({
                                    id: linkid
                                }).$promise.then(function () {
                                    ProcedureDialogV2.link.destroyById({
                                        id: id,
                                        fk: linkid
                                    }, function () {
                                        $("#text_" + linkid).remove();
                                        thisGraph.edges = underscore.without(thisGraph.edges, item);
                                        thisGraph.updateGraph();
                                        thisGraph.minimap();
                                    })
                                })

                            })
                        } else {
                            thisGraph.updateGraph();
                            thisGraph.minimap();
                        }

                        thisGraph.state.selectedNode = null;
                    })
                })

            }
            //toolbar drawline
            GraphCreator.prototype.toolbarDraw = function (d3node, d) {
                var thisGraph = this,
                    state = thisGraph.state;
                state.shiftNodeDrag = true;
                thisGraph.dragLine.classed('hidden', false)
                    .attr('d', 'M' + (d.ui_element.x + 60) + ',' + (d.ui_element.y + 30) + 'L' + (d.ui_element.x + 60) + ',' + (d.ui_element.y + 30));
                // return;
            }
            // call to propagate changes to graph
            GraphCreator.prototype.updateGraph = function () {

                let thisGraph = this,
                    consts = thisGraph.consts,
                    state = thisGraph.state,
                    mouseDownNode = state.mouseDownNode;
                thisGraph.paths = thisGraph.paths.data(thisGraph.edges);
                thisGraph.rects = thisGraph.rects.data(thisGraph.nodes);
                var paths = thisGraph.paths;
                paths.style('marker-mid', 'url(#end-arrow)')
                    .classed(consts.selectedClass, function (d) {
                        return d === state.selectedEdge;
                    })
                    .attr("d", function (d) {});


                // remove old links
                d3.selectAll("#pathG path.link").data([], function () {
                    return null;
                }).exit().remove();

                // add new paths
                paths.enter()
                    .append("path")
                    .style('marker-end', 'url(#end-arrow)')
                    .classed("link", true)
                    .attr("id", function (d) {
                        //console.log(11);
                        return d.id
                    })
                    .attr("d", function (d) {
                        let sourceNode, targetNode, sourceX,
                            sourceY, targetX, targetY;
                        sourceNode = underscore.find(thisGraph.nodes, function (node) {
                            return node.id === d.source_node_id;
                        })
                        targetNode = underscore.find(thisGraph.nodes, function (node) {
                            return node.id === d.destination_node_id;
                        })
                        if (sourceNode && targetNode) {
                            let sourceX = parseInt(sourceNode.ui_element.x) + thisGraph.consts.nodeWidth / 2,
                                sourceY = parseInt(sourceNode.ui_element.y) + thisGraph.consts.nodeHeight / 2,
                                targetX = parseInt(targetNode.ui_element.x) + thisGraph.consts.nodeWidth / 2,
                                targetY = parseInt(targetNode.ui_element.y) + thisGraph.consts.nodeHeight / 2,
                                xdifference = sourceX - targetX,
                                ydifference = sourceY - targetY,
                                absXdifference = Math.abs(xdifference),
                                absYdifference = Math.abs(ydifference);
                            if (xdifference > 0) {
                                if (absYdifference / absXdifference < 0.5) {
                                    targetX += thisGraph.consts.nodeWidth / 2;
                                    sourceX -= thisGraph.consts.nodeWidth / 2;
                                } else if (ydifference > 0) {
                                    targetY += thisGraph.consts.nodeHeight / 2;
                                    sourceY -= thisGraph.consts.nodeHeight / 2;

                                } else {
                                    targetY -= thisGraph.consts.nodeHeight / 2;
                                    sourceY += thisGraph.consts.nodeHeight / 2;
                                }
                            } else {
                                if (absYdifference / absXdifference < 0.5) {
                                    targetX -= thisGraph.consts.nodeWidth / 2;
                                    sourceX += thisGraph.consts.nodeWidth / 2;
                                } else if (ydifference > 0) {
                                    targetY += thisGraph.consts.nodeHeight / 2;
                                    sourceY -= thisGraph.consts.nodeHeight / 2;
                                } else {
                                    targetY -= thisGraph.consts.nodeHeight / 2;
                                    sourceY += thisGraph.consts.nodeHeight / 2;
                                }
                            }

                            return "M" + sourceX + "," + sourceY + "L" + targetX + "," + targetY;
                        }
                    })
                    .attr("", function (d) {
                        if (typeof d.name == "string" || d.name) {
                            let textElement = $("#text_" + d.ui_element.id);
                            let currentScale = thisGraph.getTransform(thisGraph.svgG).scale;
                            let halfPosition = this.getPointAtLength(this.getTotalLength() / 2);
                            
                            if (textElement[0]) {
                                let x = halfPosition.x - (textElement.width() + thisGraph.consts.nodeWidth / 2) * currentScale / 2;
                                textElement.attr({
                                    x: halfPosition.x,
                                    y: halfPosition.y - 5
                                }).html(d.name)
                            } else {
                                let textTag = thisGraph.createSVGNode("text");
                                $(textTag)
                                    .text(d.name)
                                $(this).parent("g").append(textTag);
                                $(textTag).attr({
                                    id: "text_" + d.ui_element.id,
                                    x: halfPosition.x,
                                    y: halfPosition.y - 5,
                                    fill: "#5aaafa",
                                    cursor: "pointer"
                                })
                            }

                        }
                    })
                    .on("mousedown", function (d) {
                        thisGraph.pathMouseDown.call(thisGraph, d3.select(this), d);
                    })
                    .on("mouseup", function (d) {
                        state.mouseDownLink = null;
                    });



                //remove node
                d3.selectAll("g.conceptG").data([], function () {
                    return null;
                }).exit().remove()


                // add new node

                var newGs = thisGraph.rects.data(thisGraph.nodes).enter()
                    .append("g")
                    .classed(consts.circleGClass, true)
                    .attr("transform", function (d) {
                        return "translate(" + d.ui_element.x + "," + d.ui_element.y + ")";
                    })
                    .on("mouseover", function (d) {
                        if (state.shiftNodeDrag) {
                            d3.select(this).classed(consts.connectClass, true);
                        }
                    })
                    .on("mouseout", function (d) {
                        d3.select(this).classed(consts.connectClass, false);
                    })
                    .on("mousedown", function (d) {
                        thisGraph.circleMouseDown.call(thisGraph, d3.select(this), d);
                    })
                    .on("mouseenter", function (d) {
                        thisGraph.state.mouseUpNode = d;
                        thisGraph.showToolbar.call(thisGraph, d3.select(this), d)
                    })
                    .on("mouseleave", function (d) {
                        thisGraph.state.mouseUpNode = null;
                        thisGraph.hideToolbar.call(thisGraph, d3.select(this), d)
                    })
                    .call(thisGraph.drag);


                newGs.each(function (data, i) {
                    let g = d3.select(this);
                    if (g && data.type.toLowerCase() == "node") {
                        g.append("rect")
                            .attr("width", thisGraph.consts.nodeWidth)
                            .attr("height", thisGraph.consts.nodeHeight)
                            // .attr("x", -50)
                            // .attr("y", -50)
                            .append("title")
                            .text(function (d) {
                                return d.name;
                            })
                    }
                    if (g && data.type.toLowerCase() == "start") {
                        g.append("circle")
                            .attr("r", 50)
                            .append("title")
                            .text(function (d) {
                                return d.name;
                            })
                    }
                })

                thisGraph.insertToolBar(newGs)
                // console.log(.selectAll("image"))


                newGs.each(function (d) {
                    thisGraph.insertTitleLinebreaks(d3.select(this), d.name);
                });


            };


            GraphCreator.prototype.createSVGNode = function (tagName) {
                return document.createElementNS("http://www.w3.org/2000/svg", tagName);
            }

            GraphCreator.prototype.getTransform = function (d3g) {
                var thisGraph = this;
                // var baseTransform = thisGraph.svgG.node().transform.baseVal,
                var baseTransform = d3g.node().transform.baseVal,
                    transformObj = {};
                if (baseTransform.length > 0) {
                    $(baseTransform).each(function (i, e) {
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


            GraphCreator.prototype.minimap = function () {
                var cloneNodes = d3.select("#nodeG").node().cloneNode(true),
                    thisGraph = this;
                $(cloneNodes).removeAttr("id")
                $(cloneNodes).children("g").each(function (i, e) {
                    $(e).removeClass("conceptG")
                    $(e).children("g").remove()
                    $(e).children("text").remove()
                })
                $("#miniNodes").children("g")
                    .remove()
                    .end()
                    .append(cloneNodes)
                    .attr("transform", "scale(" + (thisGraph.consts.minimapWidth / thisGraph.consts.svgWidth) + ")")

            }

            //minimap frame
            GraphCreator.prototype.frameInit = function () {
                let thisGraph = this,
                    consts = thisGraph.consts,
                    transform = thisGraph.getTransform(thisGraph.svgG),
                    frameTranslate = thisGraph.getTransform(d3.select("#minimapFrame")),
                    x = frameTranslate[0],
                    y = frameTranslate[1];
                $("#minimapFrame")
                    .children("rect")
                    .attr("width", consts.viewWidth / consts.minimapScale)
                    .attr("height", consts.viewHeight / consts.minimapScale)
                    .attr("x", 0)
                    .attr("y", 0)


                consts.miniZoom = d3.zoom()
                    // .scaleExtent([0.4, 1])
                    .scaleExtent([1, 2])
                    // .translateExtent([[0,0],[1000,1000]])
                    .on("start", function () {
                        d3.select("#minimap").style("cursor", "move")
                        if (thisGraph.state.minimapInital) {
                            d3.event.transform.x = thisGraph.state.minimapTransform.x;
                            d3.event.transform.y = thisGraph.state.minimapTransform.y;
                            d3.event.transform.k = thisGraph.state.minimapTransform.k;
                            thisGraph.state.minimapInital = false;
                        }
                    })
                    .on("zoom", function () { // limitX miniframe
                        let transform = d3.event.transform,
                            frameTranslate = thisGraph.getTransform(d3.select("#minimapFrame")),
                            // limitX = consts.minimapWidth * (1 - frameTranslate.scale / 2),
                            limitX = consts.minimapWidth - consts.viewWidth / consts.minimapScale * frameTranslate.scale,
                            limitY = consts.minimapHeight - consts.viewHeight / consts.minimapScale * frameTranslate.scale,
                            x = Math.max(0, Math.min(limitX, transform.x)),
                            y = Math.max(0, Math.min(limitY, transform.y)),
                            svgX = -x / frameTranslate.scale * consts.minimapScale,
                            svgY = -y / frameTranslate.scale * consts.minimapScale,
                            svgScale = frameTranslate.scale / Math.pow(frameTranslate.scale, 2);

                        thisGraph.state.minimapTransform = transform;


                        d3.select("#minimapFrame")
                            .attr("transform", "translate(" + [x, y] + ") scale(" + transform.k + ")")
                        d3.event.transform.x = x;
                        d3.event.transform.y = y;


                        d3.select(".graph")
                            .attr("transform", "translate(" + [svgX, svgY] + ") scale(" + svgScale + ")")
                    })
                // .on("end", function() {
                //     d3.select("#minimap").style("cursor", "auto")
                // })

                d3.select("#minimap").call(consts.miniZoom).on("dblclick.zoom", null);
            }



            /**** MAIN ****/


            /** MAIN SVG **/
            var width = $("#d3Test").width();
            let toolbarTop = $("#d3Test").offset().top;
            let docHeight = $(document.body).height();
            var height = width / 2 * 3
            // console.log(height);
            d3.select("#d3Test").append("svg")
                .classed("graphContent", true)
                .attr("width", width)
                .attr("height", height)

            var svg = d3.select("svg.graphContent");

            $scope.refresh = function (tabs) {
                let nodes = $scope.tabs[0].nodes;
                let edges = $scope.tabs[0].edges;
                //create g
                var graph = $scope.graph = new GraphCreator(svg, nodes, edges);
                // minimap  init
                $("#minimap")
                    .attr("height", graph.consts.minimapHeight)
                    .attr("width", graph.consts.minimapWidth)
                    .css("right", -graph.consts.minimapWidth / 4)
                    .css("bottom", -graph.consts.minimapHeight / 4)
                    .css("transform", "scale(0.5)")
                $(".minimapRect")
                    .attr("height", graph.consts.minimapHeight)
                    .attr("width", graph.consts.minimapWidth)
                // .attr("transform","scale(0.5)")
                graph.frameInit()
                // html drag event
                $("#widgets-d3 div").draggable({
                    revert: true,
                    revertDuration: 10,
                    helper: "clone",
                    scroll: false,
                    stop: function (event, ui) {
                        let top = ui.position.top,
                            left = ui.position.left,
                            title = $(event.target).text().trim(),
                            rectTop = $($("rect.panRect").position().top),
                            rectLeft = $($("rect.panRect").position().left),
                            rectWidth = $($("rect.panRect").width()),
                            rectHeight = $($("rect.panRect").height()),
                            scale, translateX, translateY, x, y,
                            transform = graph.getTransform(graph.svgG);
                        translateX = transform.x || 0;
                        translateY = transform.y || 0;
                        transform.scale = transform.scale || 1;
                        scale = transform.scale;
                        x = (left - 10 - translateX) / transform.scale;
                        y = (top - 200 - translateY) / transform.scale;
                        console.log(left);
                        console.log(transform);
                        if (top > rectTop[0] && top < (rectTop[0] + rectHeight[0]) && left > rectLeft[0] && left < (2428 * scale)) {

                            let newNode = {
                                name: title + underscore.uniqueId(''),
                                type: "NODE",
                                ui_element: {
                                    x: parseInt(x),
                                    y: parseInt(y),
                                    selected: false,
                                    previouslySelected: false
                                }
                            }
                            // return;
                            let flow = $scope.tabs[$scope.selectedIndex].flow
                            // console.log(newNode);
                            ProcedureDialogV2Node.create(newNode).$promise.then(function (node) {
                                // console.log(node);
                                node.ui_element.id = node.id;
                                ProcedureDialogV2.node.create({
                                    id: flow.id
                                }, node).$promise.then(function (v2node) {

                                    graph.nodes.push(v2node);
                                    graph.updateGraph();
                                    graph.minimap();
                                })
                            })
                        }
                    }
                });
                $(graph.svgG.node()).delegate("path.link,text", "click", function (e, d) {
                    e.stopPropagation();
                    $(this).addClass("selected").siblings().removeClass("selected");
                    let selectData = d3.select(this).data(),
                        linkdata;
                    //mark
                    if (selectData[0]) {
                        linkdata = selectData[0];
                    } else {
                        let id = $(this).attr("id").split("_")[1];
                        linkdata = d3.select(document.getElementById(id)).data()[0];
                    }

                    $scope.toggleLink();
                    $scope.singleLink = linkdata;
                    if (linkdata.condition) {
                        $scope.tmp_condition = linkdata.condition.expressions[0];
                    } else {
                        $scope.tmp_condition = "";
                    }

                    if (!$scope.singleLink.condition) {
                        $scope.enableCondition = false;
                        $scope.singleLink.condition = {
                            type: "EXPRESSION",
                            expressions: []
                        }
                    } else {
                        $scope.enableCondition = true;
                    }
                    $scope.singleLinkExpressions = $scope.singleLink.condition.expressions;

                    if (!$scope.singleLink.set) {
                        $scope.showSet = false;
                        $scope.singleLink.set = [];
                    } else {
                        $scope.showSet = true;
                    }

                    if (!$scope.singleLink.loop || underscore.isEmpty($scope.singleLink.loop)) {
                        $scope.enableLoop = false;
                        $scope.singleLink.loop = {};
                    } else {
                        $scope.enableLoop = true;
                    }
                })
                graph.collection = {};


                $scope.$watch('selectedIndex', function (current, old) {
                    previous = selected;
                    selected = tabs[current];
                    if (old + 1 && (old != current));
                    if (current + 1);
                    //add or remove 
                    graph.state.reloadDate = false;
                    $("#pathG").empty();
                    graph.nodes = selected.nodes;
                    graph.edges = selected.edges;
                    graph.updateGraph();
                    graph.minimap();
                    if (!graph.state.isInited) $scope.layoutNode();
                });
            }


            if (flowId) {
                // console.log(flowId);
                ProcedureDialogV2.findOne({
                    filter: {
                        where: {
                            id: flowId
                        }
                    }
                }).$promise.then(function (flow) {
                    $scope.thisFlow = flow;
                    tabs = $scope.tabs = [{
                        flow: flow,
                        id: "sub_1",
                        nodes: flow.nodes,
                        edges: flow.links
                    }];
                    $scope.refresh(tabs)
                    DialogRelation.find({
                        filter: {
                            where: {
                                bot_id: bot_id,
                                dialog_id: flowId
                            }
                        }
                    }).$promise.then(function (relation) {

                        if (underscore.isEmpty(relation)) {
                            DialogRelation.create({
                                "children": [],
                                "dialog_id": flowId,
                                "type": $scope.thisFlow.type,
                                "connected_nodes": [],
                                "name": $scope.thisFlow.name,
                                "bot_id": bot_id
                            }, function (relation) {
                                $scope.relationDialog = relation;
                                console.log($scope.relationDialog);
                            })
                            return;
                        } else {
                            $scope.relationDialog = relation[0];
                            console.log($scope.relationDialog);
                        }
                        CarbonComponents.Accordion.init();

                    })
                    //return;
                })
            } else {
                tabs = $scope.tabs = [{
                    flow: {
                        name: "new dialog"
                    },
                    id: "sub_1",
                    nodes: [],
                    edges: []
                }];

                $scope.refresh(tabs);
            }

        }(window.d3, $scope))

    }

    return controller;
});