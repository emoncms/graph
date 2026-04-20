//----------------------------------------------------------------------------------------
// graph.csv.js - CSV export feature
//----------------------------------------------------------------------------------------

function printcsv()
{
    if (typeof(feedlist[0]) === "undefined" ) {return};

    var timeformat = $("#csvtimeformat").val();
    var nullvalues = $("#csvnullvalues").val();
    var headers = $("#csvheaders").val();

    var csvout = "";

    var value = [];
    var line = [];
    var lastvalue = [];
    var start_time = feedlist[0].data[0][0];
    var end_time = feedlist[feedlist.length-1].data[feedlist[feedlist.length-1].data.length-1][0];
    var showName=false;
    var showTag=false;

    switch (headers) {
        case "showNameTag":
            showName=true;
            showTag=true;
            break;
        case "showName":
            showName=true;
            break;
    }

    if (showName || showTag ) {
        switch (timeformat) {
            case "unix":
                line = ["Unix timestamp"];
                break;
            case "seconds":
                line = ["Seconds since start"];
                break;
            case "datestr":
                line = ["Date-time string"];
                break;
        }

        for (var f in feedlist) {
            line.push((showTag ? feedlist[f].tag : "")+(showTag && showName ? ":" : "")+(showName ? feedlist[f].name : ""));
        }
        csvout = "\"" + line.join("\", \"")+"\"\n";
    }

    for (var z in feedlist[0].data) {
        line = [];
        // Different time format options for csv output
        if (timeformat=="unix") {
            line.push(Math.round(feedlist[0].data[z][0] / 1000));
        } else if (timeformat=="seconds") {
            line.push(Math.round((feedlist[0].data[z][0]-start_time)/1000));
        } else if (timeformat=="datestr") {
            // Create date time string
            var t = new Date(feedlist[0].data[z][0]);
            var year = t.getFullYear();
            var month = t.getMonth()+1;
            if (month<10) month = "0"+month;
            var day = t.getDate();
            if (day<10) day = "0"+day;
            var hours = t.getHours();
            if (hours<10) hours = "0"+hours;
            var minutes = t.getMinutes();
            if (minutes<10) minutes = "0"+minutes;
            var seconds = t.getSeconds();
            if (seconds<10) seconds = "0"+seconds;

            var formatted = year+"-"+month+"-"+day+" "+hours+":"+minutes+":"+seconds;
            line.push(formatted);
        }

        var nullfound = false;
        for (var f in feedlist) {
            if (value[f]==undefined) value[f] = null;
            lastvalue[f] = value[f];
            if (feedlist[f].data[z]!=undefined) {
            if (feedlist[f].data[z][1]==null) nullfound = true;
            if (feedlist[f].data[z][1]!=null || nullvalues=="show") value[f] = feedlist[f].data[z][1];
            if (value[f]!=null) value[f] = (value[f]*1.0).toFixed(feedlist[f].dp);
            line.push(value[f]+"");
            }
        }

        if (nullvalues=="remove" && nullfound) {
            // pass
        } else {
            csvout += line.join(", ")+"\n";
        }
    }
    $("#csv").val(csvout);
}

function csvShowHide(set)
{
    var action="hide";

    if (set==="swap") {
        if ($("#showcsv").html()==_lang["Show CSV Output"]) {
            action="show";
        } else {
            action="hide";
        }
    } else {
        action = (set==="1" ? "show" : "hide");
    }

    if (action==="show") {
        printcsv()
        showcsv = 1;
        $("#csv").show();
        $(".csvoptions").show();
        $("#showcsv").html(_lang["Hide CSV Output"]);
    } else {
        showcsv = 0;
        $("#csv").hide();
        $(".csvoptions").hide();
        $("#showcsv").html(_lang["Show CSV Output"]);
    }
}
