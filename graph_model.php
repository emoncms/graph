<?php

/*
  All Emoncms code is released under the GNU Affero General Public License.
  See COPYRIGHT.txt and LICENSE.txt.

  ---------------------------------------------------------------------
  Emoncms - open source energy visualisation
  Part of the OpenEnergyMonitor project:
  http://openenergymonitor.org
 */

// no direct access
defined('EMONCMS_EXEC') or die('Restricted access');

class Graph
{
    private $mysqli;
    private $group;

    public function __construct($mysqli, $group) 
    {
        $this->mysqli = $mysqli;
        $this->group = $group;
    }
        
    public function create($userid,$data)
    {
        $userid = (int) $userid;
        $data = preg_replace('/[^\w\s\-.",:#&{}\[\]]/','',$data);

        $stmt = $this->mysqli->prepare("INSERT INTO graph ( userid, data, groupid ) VALUES (?,?,0)");
        $stmt->bind_param("is", $userid, $data);
        $stmt->execute();
        $id = $this->mysqli->insert_id;
        if ($id) return array("success"=>true, "message"=>"graph saved id:$id");
        return array("success"=>false, "message"=>"error:$id");
    }
    
    public function update($userid,$id,$data)
    {
        $userid = (int) $userid;
        $id = (int) $id;
        $data = preg_replace('/[^\w\s\-.",:#&{}\[\]]/','',$data);
        
        $result = $this->mysqli->query("SELECT data FROM graph WHERE `id`='$id' AND `userid`='$userid'");
        if ($result->num_rows) {
            $stmt = $this->mysqli->prepare("UPDATE graph SET `data`=? WHERE `id`=?");
            $stmt->bind_param("si", $data, $id);
            $stmt->execute();
            return array("success"=>true, "message"=>"updated");
        }
        return array("success"=>false, "message"=>"graph does not exist");
    }
    
    public function delete($userid,$id)
    {
        $userid = (int) $userid;
        $id = (int) $id;
        $this->mysqli->query("DELETE FROM graph WHERE `id` = '$id' AND `userid` = '$userid'");
        return array("success"=>true, "message"=>"deleted");
    }
    
    public function get($userid,$id)
    {
        $userid = (int) $userid;
        $id = (int) $id;
        $result = $this->mysqli->query("SELECT userid,data FROM graph WHERE `id`='$id'");
        if ($result->num_rows) {
            $row = $result->fetch_array();
            $data = json_decode($row['data']);
            // Check for valid decode
            if ($data==null) $data = array();
            // Check for public access
            /* Option could be used for further access control (feeds are already protected)
            if ($row['userid']!=$userid) {
                if (!isset($data->public)) 
                    return array("success"=>false, "message"=>"this graph is not public");
                if (!$data->public) 
                    return array("success"=>false, "message"=>"this graph is not public");
            }*/
            return $data;
        }
        return array("success"=>false, "message"=>"graph does not exist");
    }

    public function getall($userid)
    {
        $userid = (int) $userid;

        $graphs = array('user'=>array());

        // Get user's graphs
        $result = $this->mysqli->query("SELECT id,data FROM graph WHERE `userid`='$userid'");
        while($row = $result->fetch_array())
        {
            $data = json_decode($row['data']);
            // Check for valid decode
            if ($data!=null) {
                $data->id = $row['id'];
                $graphs['user'][] = $data;
            }
        }
        // Get group's graphs
        if ($this->group!=false) {
            $graphs['groups'] = array();
            $groups = $this->group->grouplist($userid);
            foreach ($groups as $group) {
                $gid = $group['groupid'];
                $result = $this->mysqli->query("SELECT id,data FROM graph WHERE `groupid`='$gid'");
                while ($row = $result->fetch_array()) {
                    $data = json_decode($row['data']);
                    // Check for valid decode
                    if ($data != null) {
                        $data->id = $row['id'];
                        $graphs['groups'][$group['name']][] = $data;
                    }
                }
            }
        }
        return $graphs;
    }
    
    // ---------------------------------------------------------
    // Group functions
    // ---------------------------------------------------------
    
    public function creategroupgraph($userid, $data, $groupid) {
        $userid = (int) $userid;
        $data = preg_replace('/[^\w\s\-.",:#&{}\[\]]/', '', $data);
        $groupid = (int) $groupid;
        $user_role = $this->group->get_user_role($userid, $userid, $groupid);

        if ($this->group == false || ($user_role != 1 && $user_role != 2)) {
            return array("success" => false, "message" => "error: user is not admin/subadmin of the group");
        }

        $stmt = $this->mysqli->prepare("INSERT INTO graph ( userid, data, groupid ) VALUES (0,?,?)");
        $stmt->bind_param("si", $data, $groupid);
        $stmt->execute();
        $id = $this->mysqli->insert_id;
        if ($id)
            return array("success" => true, "message" => "graph saved id:$id");
        return array("success" => false, "message" => "error:$id");
    }

    public function updategroupgraph($userid, $id, $data, $groupid) {
        $userid = (int) $userid;
        $id = (int) $id;
        $data = preg_replace('/[^\w\s\-.",:#&{}\[\]]/', '', $data);
        $groupid = (int) $groupid;
        $user_role = $this->group->get_user_role($userid, $userid, $groupid);

        if ($this->group == false || ($user_role != 1 && $user_role != 2)) {
            return array("success" => false, "message" => "error: user is not admin/subadmin of the group");
        }


        $result = $this->mysqli->query("SELECT data FROM graph WHERE `id`='$id' AND `groupid`='$groupid'");
        if ($result->num_rows) {
            $stmt = $this->mysqli->prepare("UPDATE graph SET `data`=? WHERE `id`=?");
            $stmt->bind_param("si", $data, $id);
            $stmt->execute();
            return array("success" => true, "message" => "updated");
        }
        return array("success" => false, "message" => "graph does not exist or doesn't belong to group");
    }

    public function deletegroupgraph($userid, $id) {
        $userid = (int) $userid;
        $id = (int) $id;

        $result = $this->mysqli->query("SELECT groupid FROM graph WHERE `id`='$id'");
        if ($result->num_rows != 1)
            return array("success" => false, "message" => "graph id not found");
        $row = $result->fetch_array();

        $user_role = $this->group->get_user_role($userid, $userid, $row['groupid']);
        if ($user_role != 1 && $user_role != 2)
            return array("success" => false, "message" => "You are not an administrator/subadministrator of the group");

        $this->mysqli->query("DELETE FROM graph WHERE `id` = '$id'");
        return array("success" => true, "message" => "deleted");
    }
}
