//----------------------------------------------------------------------------------------
// graph.utils.js - Utility/helper functions
//----------------------------------------------------------------------------------------

// Format a timestamp for display in the window-info bar.
// Uses moment.js (already loaded) so locale-aware month/day names are handled correctly.
function printdate(timestamp) {
    const m = moment(timestamp);
    const fmt = m.year() === moment().year() ? 'D/MMM HH:mm:ss' : 'D/MMM/YYYY HH:mm:ss';
    return m.format(fmt);
}

// See: https://stackoverflow.com/questions/3665115/how-to-create-a-file-in-memory-for-user-to-download-but-not-through-server
function download_data(filename, data) {
    var blob = new Blob([data], {type: 'text/csv'});
    if(window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, filename);
    }
    else{
        var elem = window.document.createElement('a');
        elem.href = window.URL.createObjectURL(blob);
        elem.download = filename;        
        document.body.appendChild(elem);
        elem.click();        
        document.body.removeChild(elem);
    }
}

function arrayMove(array,old_index, new_index){
    array.splice(new_index, 0, array.splice(old_index, 1)[0]);
    return array;
}

// Remove null values from feed data
function remove_null_values(data, interval, max_duration = 900) {
    var last_valid_pos = 0;
    for (var pos = 0; pos < data.length; pos++) {
        if (data[pos][1] != null) {
            let null_time = (pos - last_valid_pos) * interval;
            if (null_time < max_duration) {
                for (var x = last_valid_pos + 1; x < pos; x++) {
                    data[x][1] = data[last_valid_pos][1];
                }
            }
            last_valid_pos = pos;
        }
    }
    return data;
}

function scale_values(data, scale) {
    if (scale !== undefined && scale != 1.0) {
        for (let i = 0; i < data.length; i++) {
            if (data[i][1] !== null) {
                data[i][1] = data[i][1] * scale;
            }
        }
    }
    return data;
}

function offset_values(data, offset) {
    if (offset !== undefined && offset != 0.0) {
        for (let i = 0; i < data.length; i++) {
            if (data[i][1] !== null) {
                data[i][1] = data[i][1] + 1 * offset;
            }
        }
    }
    return data;
}
