// graph.saved.js
// Save / load / delete named graphs (Vue 2 sidebar app + REST wrappers).
// Only used by view.php (not embed.php).

import { state, fromSavePayload, toSavePayload } from './graph.state.js';
import {
    fetchSavedGraphs,
    createSavedGraph,
    updateSavedGraph,
    deleteSavedGraph,
} from './graph.api.js';
import { graphReload }      from './graph.chart.js';
import { loadFeedSelector } from './graph.editor.js';
import { csvShowHide }      from './graph.csv.js';


// The Vue instance — exported so other modules can inspect saveGraphsApp.selected.
export let saveGraphsApp = null;

/**
 * Mount the "My Graphs" Vue app on #my_graphs in the sidebar.
 * Must be called after _lang is available.
 */
export function initSavedGraphsApp() {
    saveGraphsApp = new Vue({
        el: '#my_graphs',

        data: {
            selected:  -1,
            collapsed: false,
            messages: {
                none:    'None selected',
                deleted: 'Deleted',
                saved:   'Saved',
                select:  _lang['Select graph'],
            },
            original:  '',
            graphs:    {},
            timeout:   false,
            delay:     1500,
            status:    '',
            graphName: '',
        },

        computed: {
            graphsChanged() {
                return JSON.stringify(this.graphs).length !== this.original.length;
            },
            saveButtonDisabled() {
                const empty    = this.graphName === '';
                const changed  = this.graphsChanged;
                const selected = this.selected > -1;
                if (selected && !changed) return true;
                if (empty && !selected)   return true;
                return false;
            },
            nameChanged() {
                if (this.graphName === '' || this.selected < 0 || this.original === '') return false;
                try {
                    const orig = JSON.parse(this.original)[this.selected];
                    return orig && this.graphName !== orig.name;
                } catch { return false; }
            },
        },

        watch: {
            selected(newVal) {
                const graph = this.graphs[newVal];
                if (graph) {
                    this.graphName = graph.name;
                    if (graph.id !== this._getHashId()) this._setHashId(graph.id);
                    _loadSavedGraph(graph);
                } else {
                    this.graphName = '';
                    this._clearHash();
                }
            },
            graphName(newVal) {
                if (newVal !== '' && this.selected > -1) {
                    this.graphs[this.selected].name = newVal;
                }
            },
        },

        async created() {
            await this._fetchGraphs();
            const id = this._getHashId();
            if (id) this.selected = this._findById(id);

            window.addEventListener('hashchange', () => {
                const hashId = this._getHashId();
                if (hashId) this.selected = this._findById(hashId);
            });
        },

        methods: {
            async saveGraph() {
                const data = toSavePayload();
                data.name  = this.graphName;
                try {
                    if (this.graphsChanged && !this.nameChanged) {
                        const res = await updateSavedGraph(data);
                        this.status = res.message || this.messages.saved;
                    } else {
                        const res = await createSavedGraph(data);
                        const newId = String(res.message).replace('graph saved id:', '').trim();
                        this.selected = -1;
                        this.status = res.message || this.messages.saved;
                        await this._fetchGraphs();
                        this.selected = this._findById(newId);
                        this._setHashId(newId);
                    }
                } catch (err) {
                    this.status = 'Error: ' + err.message;
                }
                setTimeout(() => { this.status = ''; }, this.delay);
            },

            async deleteGraph() {
                const graph = this.graphs[this.selected];
                if (!graph) return;
                if (!window.confirm(`Delete ${graph.name} (#${graph.id}) ?`)) return;
                try {
                    const res = await deleteSavedGraph(graph.id);
                    this.selected = -1;
                    await this._fetchGraphs();
                    this.status = res.message || this.messages.deleted;
                    setTimeout(() => { this.status = ''; this._clearHash(); }, this.delay);
                } catch (err) {
                    this.status = 'Error: ' + err.message;
                }
            },

            async _fetchGraphs() {
                const list = await fetchSavedGraphs();
                this.graphs   = list.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
                this.original = JSON.stringify(this.graphs);
            },

            _findById(id) { return this.graphs.findIndex(g => String(g.id) === String(id)); },
            _getHashId()   { return window.location.hash.replace('#/Saved/', ''); },
            _setHashId(id) { if (this._getHashId() !== String(id)) window.location.hash = '/Saved/' + id; },
            _clearHash()   { history.replaceState(null, null, ' '); },
        },
    });

    // When the editor controls change, push updated data into the selected graph slot.
    $('#info').on('change', function () {
        if (!saveGraphsApp || saveGraphsApp.selected < 0) return;
        Vue.set(saveGraphsApp.graphs, saveGraphsApp.selected, toSavePayload());
    });
}

// ---------------------------------------------------------------------------
// Load a saved graph payload into the live view
// ---------------------------------------------------------------------------

function _loadSavedGraph(graph) {
    if (!graph) return;

    fromSavePayload(graph);

    // Sync DOM controls that aren't driven by the Vue watcher.
    $('#yaxis-min').val(state.yaxismin);
    $('#yaxis-max').val(state.yaxismax);
    $('#yaxis-min2').val(state.yaxismin2);
    $('#yaxis-max2').val(state.yaxismax2);
    $('#request-fixinterval')[0].checked = state.fixinterval;
    $('#showmissing')[0].checked  = state.showmissing;
    $('#showtag')[0].checked      = state.showtag;
    $('#showlegend')[0].checked   = state.showlegend;
    $('#request-type').val(state.mode);

    if (state.mode !== 'interval') {
        $('.fixed-interval-options').hide();
    } else {
        $('.fixed-interval-options').show();
    }

    graphReload();
    loadFeedSelector();

    $('#csvtimeformat').val(state.csvtimeformat);
    $('#csvnullvalues').val(state.csvnullvalues);
    $('#csvheaders').val(state.csvheaders);
    csvShowHide(state.showcsv ? '1' : '0');
}
