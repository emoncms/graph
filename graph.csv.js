//----------------------------------------------------------------------------------------
// graph.csv.js - CSV export feature
//----------------------------------------------------------------------------------------

function printcsv()
{
    if (typeof feedlist[0] === "undefined") return;

    const timeformat = $("#csvtimeformat").val();
    const nullvalues = $("#csvnullvalues").val();
    const headers = $("#csvheaders").val();

    let csvout = "";

    const value = [];
    let line = [];
    const lastvalue = [];
    const start_time = feedlist[0].data[0][0];
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
        for (const f in feedlist) {
            line.push((showTag ? feedlist[f].tag : "") + (showTag && showName ? ":" : "") + (showName ? feedlist[f].name : ""));
        }
        csvout = '"' + line.join('", "') + '"\n';
    }

    for (const z in feedlist[0].data) {
        line = [];
        if (timeformat === "unix") {
            line.push(Math.round(feedlist[0].data[z][0] / 1000));
        } else if (timeformat === "seconds") {
            line.push(Math.round((feedlist[0].data[z][0] - start_time) / 1000));
        } else if (timeformat === "datestr") {
            const t = new Date(feedlist[0].data[z][0]);
            const year    = t.getFullYear();
            const month   = String(t.getMonth() + 1).padStart(2, '0');
            const day     = String(t.getDate()).padStart(2, '0');
            const hours   = String(t.getHours()).padStart(2, '0');
            const minutes = String(t.getMinutes()).padStart(2, '0');
            const seconds = String(t.getSeconds()).padStart(2, '0');
            line.push(`${year}-${month}-${day} ${hours}:${minutes}:${seconds}`);
        }

        let nullfound = false;
        for (const f in feedlist) {
            if (value[f] === undefined) value[f] = null;
            lastvalue[f] = value[f];
            if (feedlist[f].data[z] !== undefined) {
                if (feedlist[f].data[z][1] === null) nullfound = true;
                if (feedlist[f].data[z][1] !== null || nullvalues === "show") value[f] = feedlist[f].data[z][1];
                if (value[f] !== null) value[f] = (value[f] * 1.0).toFixed(feedlist[f].dp);
                line.push(value[f] + "");
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
