<?php

// no direct access
defined('EMONCMS_EXEC') or die('Restricted access');

function graph_controller()
{
    global $session,$route,$mysqli,$redis, $path;

    require_once "Modules/graph/graph_model.php";
    $graph = new Graph($mysqli);

    $result = "";
    
    if ($route->action=="embed") {
        global $embed; $embed = true;
        $result = view("Modules/graph/embed.php",array());
    }
    
    // Standard graph methods
    else if ($session['write'] && $route->action=="create" && isset($_POST['data'])) {
        $route->format="json";
        $result = $graph->create($session['userid'],post('data'));
    }
    
    else if ($session['write'] && $route->action=="update" && isset($_POST['id']) && isset($_POST['data'])) {
        $route->format="json";
        $result = $graph->update($session['userid'],post('id'),post('data'));
    }
    
    else if ($session['write'] && $route->action=="delete" && isset($_POST['id'])) {
        $route->format="json";
        $result = $graph->delete($session['userid'],post('id'));
    }
    
    else if ($route->action=="get" && isset($_GET['id'])) {
        $route->format="json";
        if (isset($session['userid'])) $userid = $session['userid']; else $userid = 0;
        $result = $graph->get($userid,get('id'));
    }

    else if ($session['read'] && $route->action=="getall") {
        $route->format="json";
        $result = $graph->getall($session['userid']);
    }

    else {
        if (!$session['read'] && !$session['public_userid']) return "";
        $result = view("Modules/graph/view.php", array());
    }

    return array('content' => $result, 'fullwidth' => true);
}
