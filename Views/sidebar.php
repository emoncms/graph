<div class="htop"></div><h3 class="l3-title mx-3"><?php echo tr('Graph') ?> </h3><div id="feed-selector-app"></div>

<script type="text/x-template" id="feed-selector-template">
    <table id="feeds" class="table table-condensed mx-3" style="width: 90%;">
        <colgroup>
            <col span='1' style='width: 70%;'>
            <col span='1' style='width: 15%;'>
            <col span='1' style='width: 15%;'>
        </colgroup>
        <template v-for="(tagFeeds, tag) in feedsByTag">
            <thead>
                <tr class='tagheading' :data-tag='tag' tabindex='0'
                    @click="toggleTag(tag)" @keyup.enter="toggleTag(tag)">
                    <th colspan='3'><span class='caret'></span>{{tag}}</th>
                </tr>
            </thead>
            <tbody class='tagbody' :data-tag='tag' v-show="!collapsedTags[tag]">
                <tr v-for="feed in tagFeeds" style='color:#666'>
                    <th class='feed-title' :title='truncateName(feed.name)' :data-feedid='feed.id' tabindex='0'
                        @click="onFeedTitleClick(feed.id)" @keyup.enter="onFeedTitleClick(feed.id)">
                        <span class='text-truncate d-inline-block'>{{truncateName(feed.name)}}</span>
                    </th>
                    <td><input class='feed-select-left' :data-feedid='feed.id' type='checkbox'
                        :checked='leftChecked.has(+feed.id)'
                        @change="onLeftChange(feed.id, $event.target.checked)"></td>
                    <td><input class='feed-select-right' :data-feedid='feed.id' type='checkbox'
                        :checked='rightChecked.has(+feed.id)'
                        @change="onRightChange(feed.id, $event.target.checked)"></td>
                </tr>
            </tbody>
        </template>
    </table>
</script>

<div id="my_graphs" class="px-3" v-cloak>
    <h4>
        <a href="#" @click.prevent="collapsed=!collapsed" :class="{'collapsed': collapsed}">
            <?php echo tr('My Graphs') ?> 
            <span class="arrow arrow-down pull-right"></span>
        </a>
    </h4>

    <div v-if="!collapsed">
        <form @submit.prevent>
            <select id="graph-select" v-model="selected">
                <option value="-1">{{ messages.select }} :</option>
                <option v-for="(item, index) in graphs" :value="index">[#{{item.id}}] {{item.name}}</option>
            </select>
            <h5><?php echo tr('Graph Name') ?>:</h5>

            <input id="graphName" v-model="graphName" type="text" placeholder="<?php echo tr('Graph Name') ?>">
            
            <small v-if="selected > -1" class="help-block text-light">
                <?php echo tr('Selected graph id') ?>: {{ graphs[selected].id }}
            </small>
            <small v-if="selected < 0" class="help-block text-light">
                <?php echo tr('None selected') ?>
            </small>

            <button type="button" class="btn" @click="deleteGraph" :class="{'d-none': selected === ''}"><?php echo tr('Delete') ?></button>
            <button :disabled="saveButtonDisabled" class="btn" @click="saveGraph"><?php echo tr('Save') ?></button>
            <transition name="fade">
                <p v-if="status!==''">
                    <small class="text-white pt-2 d-inline-block">{{status.substr(0, 1).toUpperCase() + status.substr(1)}}</small>
                </p>
            </transition>
        </form>
    </div>
</div>
