//----------------------------------------------------------------------------------------
// graph.saved.js - Save/load named graphs (Vue.js app + REST API wrappers)
//----------------------------------------------------------------------------------------

/**
 * return -1 for less than, 1 for more than, else 0
 * @param {Object} a
 * @param {Object} b
 * @param {String} prop property name to compare
 */
function compare_name( a, b ) {
    var prop = 'name'
    if ( a[prop] < b[prop] ){
        return -1
    }
    if ( a[prop] > b[prop] ){
        return 1
    }
    return 0
}

function load_saved_graphs_menu()
{
    saveGraphsApp = new Vue({
        el: '#my_graphs',
        data: {
            selected: -1,
            collapsed: false,
            messages: {
                none: 'None selected',
                deleted: 'Deleted',
                saved: 'Saved',
                select: _lang['Select graph']
            },
            original: '',
            graphs: {},
            apikeystr: apikeystr,
            timeout: false,
            delay: 1500,
            status: '',
            graphName: ''
        },
        methods: {
            /**
             * update or create saved graph
             */
            saveGraph: function(){
                var vm = this
                var data = get_graph_data()
                // @todo : check for duplicate name
                // @todo : check for new name - if new create, else update
                data.name = this.graphName

                if (this.graphsChanged && !this.nameChanged) {
                    // UPDATE
                    graph_update(data)
                    .done(function(response) {
                        if(typeof response.success == 'undefined' || response.success) {
                            vm.status = response.message || vm.messages.saved
                        } else {
                            vm.status = "error 322"
                        }
                        window.setTimeout(function() {
                            vm.status = ""
                        }, vm.delay)
                    })
                } else {
                    // CREATE
                    graph_create(data)
                    .done(function(response) {
                        var newId = response.message.replace('graph saved id:','')
                        vm.selected = -1
                        vm.status = response.message || vm.messages.saved
                        window.setTimeout(function() {
                            vm.status = ''
                        }, vm.delay)

                        // get new data once saved.
                        vm.getGraphs()
                        .done(function(){
                            // pre-select the new item
                            vm.selected = vm.findGraphIndexById(newId)
                            // add new graph to browser history
                            vm.updateHashState(newId)
                        })
                    })
                }

            },
            deleteGraph: function(){
                var vm = this
                if(window.confirm('Delete ' + this.graphs[this.selected].name + ' (#' + this.graphs[this.selected].id + ') ?')) {
                    graph_delete(this.graphs[this.selected].id)
                    .done(function(response) {
                        vm.selected = -1
                        vm.getGraphs()
                        vm.status = response.message || vm.messages.deleted
                        window.setTimeout(function() {
                            vm.status = ''
                            vm.emptyHashState()
                        }, vm.delay)
                    })
                }
            },
            /**
             * load data from graph/getall
             */
            getGraphs: function () {
                var vm = this
                return $.getJSON(path+"/graph/getall"+this.apikeystr)
                .done(function(response){
                    if (!response.success && response.success !== false) {
                        // @todo : work with response.groups
                        // save sorted list to vue data
                        vm.graphs = response.user.sort( compare_name )
                        vm.original = JSON.stringify(vm.graphs)
                        // if view called with graph/#Saved/[id]
                        // find the relevant graph in the list
                        var hashId = vm.getHashState()
                        if (hashId !== '') {
                            var index = vm.findGraphIndexById(hashId)
                            if(index > -1) {
                                vm.selected = vm.graphs[index].name
                            }
                        }
                    } else {
                        vm.message = response.messsage
                    }
                })
            },
            /**
             * get graphs[] index that stores graph with matching id
             * @param {String} id taken from api response
             * @return {Number} array index of match, else -1
             */
            findGraphIndexById: function(id) {
                return this.findGraph('id', id)
            },
            /**
             * get graphs[] index that stores graph with matching id
             * @param {String} name taken from form selections
             * @return {Number} array index of match, else -1
             */
            findGraphIndexByName: function(name) {
                return this.findGraph('name', name)
            },
            /**
             * search loaded graphs by property and value
             * @return first index of matched value
             */
            findGraph: function(property, value) {
                return this.find(this.graphs, property, value)
            },
            /**
             * Return object key if property value matches
             * @param {Object} list Enumerable Object to search
             * @param {String} property Object property to compare
             * @param {*} value Object property value to compare
             * @return {Number} first matching index, else -1
             */
            find: function (list, property, value) {
                if (typeof list === 'undefined' || typeof property === 'undefined' || typeof value === 'undefined') {
                    return -1
                }
                for (const n in list) {
                    const item = list[n]
                    if (item.hasOwnProperty(property)) {
                        if (item[property] === value) {
                            return n
                        }
                    }
                }
                return -1
            },
            getHashState: function() {
                // get the id of the saved graph from the url
                return window.location.hash.replace('#/Saved/','')
            },
            updateHashState: function(id){
                // add the '#/Saved/[id]' symbol to the url
                var hashId = this.getHashState()
                if (hashId === "" || id !== hashId) {
                    window.location.hash = '/Saved/' + id
                }
            },
            emptyHashState: function(){
                // remove the '#' symbol from url
                history.replaceState(null, null, ' ')
            }
        },
        computed: {
            graphsChanged: function() {
                return JSON.stringify(this.graphs).length !== this.original.length
            },
            saveButtonDisabled: function() {
                var empty = this.graphName === ''
                var changed = this.graphsChanged
                var selected = this.selected > -1

                if ( selected && !changed ) {
                    return true
                }
                if ( empty && !selected) {
                    return true
                }
                return false
            },
            /**
             * return true if new or saved graph name changed
             */
            nameChanged: function() {
                var empty = this.graphName === ''
                var selected = this.selected > -1
                var downloaded = this.original !== ''

                if (!downloaded || empty) {
                    return false
                } else {
                    var originalSelected = {}
                    try {
                        originalSelected = JSON.parse(this.original)[this.selected]
                    } catch (error) {}
                    if(originalSelected && this.graphName === originalSelected.name) {
                        return false
                    }
                }
                return true
            }
        },
        watch: {
            /**
             * `selected` is array index of currently selected graph
             */
            selected: function (newVal) {
                // change the name of the selected graph to display
                // change global id of selected item
                var graph = this.graphs[newVal]
                if (graph) {
                    this.graphName = graph.name
                    if (graph.id !== this.getHashState()) {
                        this.updateHashState(graph.id)
                    }
                    // use function outside of vuejs to update the graph and menu
                    load_saved_graph(this.graphs[newVal])
                } else {
                    this.graphName =  ''
                    this.emptyHashState()
                }
            },
            graphName: function (newVal) {
                if (newVal !== "" && this.selected > -1) {
                    this.graphs[this.selected].name = newVal
                } else {
                    graphsChanged = true
                }
            }
        },
        created: function () {
            var vm = this
            this.getGraphs()
            .done(function(){
                var newId = vm.getHashState()
                // pre-select the item
                vm.selected = vm.findGraphIndexById(newId)
            })
            window.addEventListener('hashchange', function(event) {
                var hashId = vm.getHashState()
                if (hashId !== '') {
                    vm.selected = vm.findGraphIndexById(hashId)
                }
            });
        }
    })
}

$(function(){
    // when the form changes send the new data into the "saved list" vue app (if available)
    $('#info').on('change', function(event) {
        if (saveGraphsApp) {
            if(saveGraphsApp.selected > -1) {
                Vue.set(saveGraphsApp.graphs, saveGraphsApp.selected, get_graph_data())
            }
        }
    })
})

// place data into view (not vue.js)
function load_saved_graph(graph) {
    // @todo: unload_saved_graph()

    if (typeof graph === 'undefined') return;
    if (graph.mode == undefined) graph.mode = 'interval';

    // view settings
    view.start = graph.start;
    view.end = graph.end;
    view.interval = graph.interval;
    view.mode = graph.mode;
    view.limitinterval = graph.limitinterval;
    view.fixinterval = graph.fixinterval;
    graphState.floatingtime = graph.floatingtime;
    graphState.yaxismin = graph.yaxismin;
    graphState.yaxismin2 = graph.yaxismin2 || 'auto';
    graphState.yaxismax = graph.yaxismax;
    graphState.yaxismax2 = graph.yaxismax2 || 'auto';

    // CSV display settings
    graphState.csvtimeformat = (typeof graph.csvtimeformat === 'undefined' ? 'datestr' : graph.csvtimeformat);
    graphState.csvnullvalues = (typeof graph.csvnullvalues === 'undefined' ? 'show' : graph.csvnullvalues);
    graphState.csvheaders = (typeof graph.csvheaders === 'undefined' ? 'showNameTag' : graph.csvheaders);
    const tmpCsv = (typeof graph.showcsv === 'undefined' ? '0' : graph.showcsv.toString());

    // show settings
    graphState.showmissing = graph.showmissing;
    graphState.showtag = graph.showtag;
    graphState.showlegend = graph.showlegend;

    // graph details
    graphState.current_graph_id = graph.id;
    graphState.current_graph_name = graph.name;

    // feedlist
    graphState.feedlist = graph.feedlist;

    if (graphState.floatingtime) {
        const timewindow = view.end - view.start;
        const now = Math.round(+new Date() * 0.001) * 1000;
        view.end = now;
        view.start = view.end - timewindow;
    }

    $("#yaxis-min").val(graphState.yaxismin);
    $("#yaxis-max").val(graphState.yaxismax);
    $("#yaxis-min2").val(graphState.yaxismin2);
    $("#yaxis-max2").val(graphState.yaxismax2);
    $("#request-fixinterval")[0].checked = view.fixinterval;
    // view.limitinterval watcher (initViewWatcher) syncs this to the checkbox automatically.
    $("#showmissing")[0].checked = graphState.showmissing;
    $("#showtag")[0].checked = graphState.showtag;
    $("#showlegend")[0].checked = graphState.showlegend;

    $("#request-type").val(view.mode);
    if (view.mode !== "interval") {
        $(".fixed-interval-options").hide();
    } else {
        $(".fixed-interval-options").show();
    }

    // draw graph
    graph_reload();
    load_feed_selector();
    // Placed after graph load as values only available after the graph is redrawn
    $("#csvtimeformat").val(graphState.csvtimeformat);
    $("#csvnullvalues").val(graphState.csvnullvalues);
    $("#csvheaders").val(graphState.csvheaders);
    csvShowHide(tmpCsv);
}

function get_graph_data() {

    const now = Math.round(+new Date() * 0.001) * 1000;
    if (Math.abs(now - view.end) < 120000) {
        graphState.floatingtime = 1;
    }

    const graph_to_save = {
        name: graphState.current_graph_name,
        start: view.start,
        end: view.end,
        interval: view.interval,
        mode: view.mode,
        limitinterval: view.limitinterval,
        fixinterval: view.fixinterval,
        floatingtime: graphState.floatingtime,
        yaxismin: graphState.yaxismin,
        yaxismax: graphState.yaxismax,
        yaxismin2: graphState.yaxismin2,
        yaxismax2: graphState.yaxismax2,
        showmissing: graphState.showmissing,
        showtag: graphState.showtag,
        showlegend: graphState.showlegend,
        showcsv: graphState.showcsv,
        csvtimeformat: graphState.csvtimeformat,
        csvnullvalues: graphState.csvnullvalues,
        csvheaders: graphState.csvheaders,
        feedlist: JSON.parse(JSON.stringify(graphState.feedlist)),
        id: graphState.current_graph_id,
    };
    return graph_to_save
}

function graph_update(data) {
    // Clean feedlist of data and stats that dont need to be saved
    for (const i in data.feedlist) {
        delete data.feedlist[i].data;
        delete data.feedlist[i].stats;
    }

    // Save
    return $.ajax({
        method: "POST",
        url: path+"/graph/update",
        data: "id="+data.id+"&data="+JSON.stringify(data),
        dataType: "json",
        success: function(result) {
            if (!result.success) alert("ERROR: "+result.message);
        },
        error: function(xhr,type,message) {
            alert("ERROR: "+type+":"+message);
        }
    });
}

function graph_create(data) {
    // Clean feedlist of data and stats that dont need to be saved
    for (var i in data.feedlist) {
        delete data.feedlist[i].data
        delete data.feedlist[i].stats;
    }
    data.name = encodeURIComponent(data.name)
    // Save
    var ajax = $.ajax({
        method: "POST",
        url: path+"/graph/create",
        data: "data="+JSON.stringify(data),
        async: true,
        dataType: "json",
        success: function(result) {
            if (!result.success) alert("ERROR: "+result.message);
        }
    });
    return ajax
}

function graph_delete(id) {
    // Save
    var ajax = $.ajax({
        method: "POST",
        url: path+"/graph/delete",
        data: "id="+id,
        async: true,
        dataType: "json",
        success: function(result) {
            if (!result.success) alert("ERROR: "+result.message);
        }
    });
    return ajax
}
