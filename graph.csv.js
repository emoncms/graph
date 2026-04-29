// graph.csv.js
// CSV export: build, display, and download CSV from the current feedlist.
// Imports state directly; no jQuery dependency beyond the textarea selector.

import { state } from './graph.state.js';
import { downloadData } from './graph.utils.js';

export function printCsv()
{
    if (!state.feedlist.length) return;

    const timeformat = state.csvtimeformat;
    const nullvalues = state.csvnullvalues;
    const headers = state.csvheaders;

    let csvout = "";

    const value = [];
    let line = [];
    const lastvalue = [];
    const start_time = state.feedlist[0].data[0][0];
    let showName = false;
    let showTag = false;

    switch (headers) {
        case "showNameTag": showName = true; showTag = true; break;
        case "showName":    showName = true; break;
    }

    if (showName || showTag) {
        switch (timeformat) {
            case "unix":    line = ["Unix timestamp"]; break;
            case "seconds": line = ["Seconds since start"]; break;
            case "datestr": line = ["Date-time string"]; break;
        }
        for (const f in state.feedlist) {
            line.push((showTag ? state.feedlist[f].tag : '') + (showTag && showName ? ':' : '') + (showName ? state.feedlist[f].name : ''));
        }
        csvout = '"' + line.join('", "') + '"\n';
    }

    for (const z in state.feedlist[0].data) {
        line = [];
        if (timeformat === 'unix') {
            line.push(Math.round(state.feedlist[0].data[z][0] / 1000));
        } else if (timeformat === 'seconds') {
            line.push(Math.round((state.feedlist[0].data[z][0] - start_time) / 1000));
        } else if (timeformat === 'datestr') {
            const t = new Date(state.feedlist[0].data[z][0]);
            const year    = t.getFullYear();
            const month   = String(t.getMonth() + 1).padStart(2, '0');
            const day     = String(t.getDate()).padStart(2, '0');
            const hours   = String(t.getHours()).padStart(2, '0');
            const minutes = String(t.getMinutes()).padStart(2, '0');
            const seconds = String(t.getSeconds()).padStart(2, '0');
            line.push(`${year}-${month}-${day} ${hours}:${minutes}:${seconds}`);
        }

        let nullfound = false;
        for (const f in state.feedlist) {
            if (value[f] === undefined) value[f] = null;
            lastvalue[f] = value[f];
            if (state.feedlist[f].data[z] !== undefined) {
                if (state.feedlist[f].data[z][1] === null) nullfound = true;
                if (state.feedlist[f].data[z][1] !== null || nullvalues === 'show') value[f] = state.feedlist[f].data[z][1];
                if (value[f] !== null) value[f] = (value[f] * 1.0).toFixed(state.feedlist[f].dp);
                line.push(value[f] + '');
            }
        }

        if (nullvalues === "remove" && nullfound) {
            // pass
        } else {
            csvout += line.join(", ") + "\n";
        }
    }
    $("#csv").val(csvout);
}

export function csvShowHide(set) {
    let show;
    if (set === 'swap') {
        show = $('#showcsv').html() === _lang['Show CSV Output'];
    } else {
        show = set === '1' || set === 1;
    }

    if (show) {
        printCsv();
        state.showcsv = 1;
        $('#csv').show();
        $('.csvoptions').show();
        $('#showcsv').html(_lang['Hide CSV Output']);
    } else {
        state.showcsv = 0;
        $('#csv').hide();
        $('.csvoptions').hide();
        $('#showcsv').html(_lang['Show CSV Output']);
    }
}
