<?php
    $domain = "messages";
    bindtextdomain($domain, "Modules/graph/locale");
    bind_textdomain_codeset($domain, 'UTF-8');
    //$menu_dropdown_config[] = array('name'=> dgettext($domain,"Graphs"), 'icon'=>'icon-retweet', 'path'=>"graph" , 'session'=>"write", 'order' => 25 );
    $menu_dropdown_config[] = array('name'=> dgettext($domain,"Graphs"), 'icon'=>'icon-retweet', 'path'=>"graph/groupgraph" , 'session'=>"write", 'order' => 25 );
