<?php
global $session;
if ($session["read"] || isset($_GET['userid'])) {  // allow emoncms.org/graph?userid=1 to work
// Initial graph menu item placement
    $menu["setup"]["l2"]['graph'] = array(
        "name"=>_("Graphs"),
        "href"=>"graph",
        "order"=>3, 
        "icon"=>"show_chart"
    );
}
// Full level3 sidebar is added via javascript in graph.js
