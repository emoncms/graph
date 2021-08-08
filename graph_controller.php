<?php

// no direct access
defined('EMONCMS_EXEC') or die('Restricted access');

function graph_controller()
{
    global $session,$route,$mysqli,$redis, $path;

    // Check if group module is installed
    $group = false;
    if (file_exists("Modules/group/group_model.php")) {
        require_once "Modules/group/group_model.php";
        $group = new Group($mysqli, $redis, null, null, null);
    }

    require_once "Modules/graph/graph_model.php";
    $graph = new Graph($mysqli, $group);

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
    
    // Group graph methods
    else if ($group && $session['write'] && $route->action == "creategroupgraph" && isset($_POST['data']) && isset($_POST['groupid'])) {
        $route->format = "json";
        $result = $graph->creategroupgraph($session['userid'], post('data'), post('groupid'));
    }
    
    else if ($group && $session['write'] && $route->action == "updategroupgraph" && isset($_POST['id']) && isset($_POST['data'])) {
        $route->format = "json";
        $result = $graph->updategroupgraph($session['userid'], post('id'), post('data'),post('groupid'));
    }
    
    else if ($group && $session['write'] && $route->action == "deletegroupgraph" && isset($_POST['id'])) {
        $route->format = "json";
        $result = $graph->deletegroupgraph($session['userid'], post('id'));
    }
    
    else if ($group && $route->action=="groupgraph") {
        $result = view("Modules/graph/group_view.php", array("session" => $session["write"], 'group_support' => 1));
    }
    else {
        $result = view("Modules/graph/view.php", array("session" => $session["write"]));
    }

    return array('content' => $result, 'fullwidth' => true);
}
