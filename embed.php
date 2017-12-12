<?php
    /*
    All Emoncms code is released under the GNU Affero General Public License.
    See COPYRIGHT.txt and LICENSE.txt.

    ---------------------------------------------------------------------
    Emoncms - open source energy visualisation
    Part of the OpenEnergyMonitor project:
    http://openenergymonitor.org
    */

    global $path, $embed;
    global $fullwidth;
    $fullwidth = true;
    
    $graphid = get("graphid");
?>

<!--[if IE]><script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/excanvas.min.js"></script><![endif]-->
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.time.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.selection.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.touch.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Lib/flot/jquery.flot.togglelegend.min.js"></script>
<script language="javascript" type="text/javascript" src="<?php echo $path;?>Modules/graph/vis.helper.js"></script>

<div id="navigation" style="padding-bottom:5px;">
    <button class='btn graph_time' type='button' time='1'>D</button>
    <button class='btn graph_time' type='button' time='7'>W</button>
    <button class='btn graph_time' type='button' time='30'>M</button>
    <button class='btn graph_time' type='button' time='365'>Y</button>
    <button id='graph_zoomin' class='btn'>+</button>
    <button id='graph_zoomout' class='btn'>-</button>
    <button id='graph_left' class='btn'><</button>
    <button id='graph_right' class='btn'>></button>
</div>

<div id="placeholder_bound" style="width:100%; height:100%">
    <div id="placeholder"></div>
</div>

<script language="javascript" type="text/javascript" src="<?php echo $path;?>Modules/graph/graph.js"></script>

<script>
    $("body").css("background","none");
    embed = true;
    
    var path = "<?php echo $path; ?>";
    
    var graphid = "<?php echo $graphid; ?>";
    
    $.ajax({                                      
        url: path+"/graph/get?id="+graphid,
        async: true,
        dataType: "json",
        success: function(result) {
            
            view.start = result.start;
            view.end = result.end;
            view.interval = result.interval;
            view.limitinterval = result.limitinterval;
            view.fixinterval = result.fixinterval;
            floatingtime = result.floatingtime,
            yaxismin = result.yaxismin;
            yaxismax = result.yaxismax;
            feedlist = result.feedlist;
            
            // show settings
            showmissing = result.showmissing;
            showtag = result.showtag;
            showlegend = result.showlegend;
            
            if (floatingtime) {
                var timewindow = view.end - view.start;
                var now = Math.round(+new Date * 0.001)*1000;
                view.end = now;
                view.start = view.end - timewindow;
            }

            if (result.source != undefined && result.source == 'groups'){
                vis_mode = 'groups';
                 $.ajax({url: path + "/group/mygroups.json", async: false, dataType: "json", success: function (data_in) {
                    groups = data_in;
                }});                
            }
            else
                vis_mode = 'user';

            graph_resize();
            graph_reloaddraw();
        }
    });
    

</script>

