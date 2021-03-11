<?php

    $menu['sidebar']['emoncms'][] = array(
        'text' => _("Graphs"),
        'path' => 'graph',
        'active'=>'graph',
        'icon' => 'show_chart',
        'order' => 2,
        'li_id' => 'graph-link',
        'data'=> array('sidebar' => '#sidebar_graph')
    );

    $menu['sidebar']['includes']['emoncms']['graph'] = view('Modules/graph/Views/sidebar.php',array());
