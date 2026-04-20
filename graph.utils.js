//----------------------------------------------------------------------------------------
// graph.utils.js - Utility/helper functions
//----------------------------------------------------------------------------------------

/**
 * @todo replace this with moment.js translated date/time strings
 * see feed and input views for example of translated dates
 * eg. moment().fromUnix(timestamp).format('ll') // format unix timestamp as per user's locale
 * @see Lib/misc/moment.min.js
 **/
function printdate(timestamp)
{
    var date = new Date();
    var thisyear = date.getFullYear();

    var date = new Date(timestamp);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = date.getFullYear();
    var month = months[date.getMonth()];
    var day = date.getDate();

    var minutes = date.getMinutes();
    if (minutes<10) minutes = "0"+minutes;

    var secs = date.getSeconds();
    if (secs<10) secs = "0"+secs;

    var datestr = "";
    //	date.getHours()+":"+minutes+" "+day+" "+month;
    datestr += day+"/"+month;
    if (thisyear!=year) datestr += "/"+year;
    datestr += " " + date.getHours()+":"+minutes+":"+secs;
    return datestr;
};

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
