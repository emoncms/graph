<?php
global $session;

if ($session["read"] || $session['public_userid']) {
    // Initial graph menu item placement
    $menu["setup"]["l2"]['graph'] = array(
        "name"=>_("Graphs"),
        "href"=>"graph",
        "order"=>3, 
        "icon"=>"show_chart"
    );

    if ($session['public_userid']) {
        $menu["setup"]["l2"]['graph']["href"] = $session['public_username']."/graph";
    }

    // Full level3 sidebar is added via javascript in graph.js
}
