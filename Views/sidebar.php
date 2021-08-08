<div class="htop"></div><h3 class="l3-title mx-3"><?php echo _('Graph') ?> </h3><table class="table table-condensed mx-3" id="feeds" style="width: 90%;"></table>

<div id="my_graphs" class="px-3" v-cloak>
    <h4>
        <a href="#" @click.prevent="collapsed=!collapsed" :class="{'collapsed': collapsed}">
            <?php echo _('My Graphs') ?> 
            <span class="arrow arrow-down pull-right"></span>
        </a>
    </h4>

    <div v-if="!collapsed">
        <form @submit.prevent>
            <select id="graph-select" v-model="selected">
                <option value="-1">{{ messages.select }} :</option>
                <option v-for="(item, index) in graphs" :value="index">[#{{item.id}}] {{item.name}}</option>
            </select>
            <h5><?php echo _('Graph Name') ?>:</h5>

            <input id="graphName" v-model="graphName" type="text" placeholder="<?php echo _('Graph Name') ?>">
            
            <small v-if="selected > -1" class="help-block text-light">
                <?php echo _('Selected graph id') ?>: {{ graphs[selected].id }}
            </small>
            <small v-if="selected < 0" class="help-block text-light">
                <?php echo _('None selected') ?>
            </small>

            <button type="button" class="btn" @click="deleteGraph" :class="{'d-none': selected === ''}"><?php echo _('Delete') ?></button>
            <button :disabled="saveButtonDisabled" class="btn" @click="saveGraph"><?php echo _('Save') ?></button>
            <transition name="fade">
                <p v-if="status!==''">
                    <small class="text-white pt-2 d-inline-block">{{status.substr(0, 1).toUpperCase() + status.substr(1)}}</small>
                </p>
            </transition>
        </form>
    </div>
</div>
