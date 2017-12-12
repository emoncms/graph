<?php

$schema['graph'] = array(
    'id' => array('type' => 'int(11)', 'Null'=>'NO', 'Key'=>'PRI', 'Extra'=>'auto_increment'),
    'userid' => array('type' => 'int(11)'),
    'groupid' => array('type' => 'int(11)', 'default' => 0),
    'data' => array('type' => 'text')
);
