
Tasks = new Meteor.Collection('tasks');
UserData = new Meteor.Collection('userData');

function userIdMatches(userId, docs) {
    for (var i=0, len=docs.length; i<len; i++) {
        if (userId != docs[i].userId) {
            return false;
        }
    }
    return true;
}

Tasks.allow({
    insert: function(userId, doc) {
        return userId == doc.userId;
    },
    update: function(userId, docs, fields, modifier) {
        return userIdMatches(userId, docs) &&
            fields.userId === undefined;
    },
    remove: function(userId, docs) {
        return userIdMatches(userId, docs);
    }
});

UserData.allow({
    insert: function(userId, doc) {
        return false;
    },
    update: function(userId, docs, fields, modifier) {
        return userIdMatches(userId, docs) &&
            ('userId' in fields ? fields.userId == userId : true);
    },
    remove: function(userId, docs) {
        return false;
    }
});

function getTime(date) {
    return (date || new Date()).getTime();
}


if (Meteor.isClient) {

    Meteor.autorun(function() {
        Meteor.subscribe('userTasks');
        Meteor.subscribe('userData');
    });

    //
    // Help Arrows
    //
    Template.loginHelper.show = function() {
        return !Meteor.user();
    };

    Template.addHelper.show = function() {
        return (!Template.loginHelper.show() &&
                !Tasks.find({active: true}).count());
    };

    var footerHelperState = undefined;

    Template.footerHelper.show = function() {
        var user = Meteor.user();
        if (!user) return false;
        var userData = UserData.findOne({userId: user._id});
        return (footerHelperState = (userData && userData.footerHelper));
    };

    function addTask() {
        //TODO - is there a way to delay server-side insert?
        var userId = Meteor.userId();
        if (!userId) return;

        var taskId = Tasks.insert({
            text: '',
            created: getTime(),
            userId: userId,
            active: true
        });
        Session.set('selectedTask', taskId);
        Session.set('editTask', taskId);
    }

    Meteor.startup(function() {
        $('#add-task').click(function(e) {
            e.preventDefault();
            addTask();
        });
    });

    //
    // Boxes
    //

    Session.set('selectedTask', null);
    Session.set('editTask', null);

    Template.boxes.tasks = function() {
        return Tasks.find({active: true}, {sort: {"created": -1}});
    };

    Template.inactiveBoxes.tasks = function() {
        return Tasks.find({active: false}, {sort: {"created": -1}});
    };

    Template.box.selected = function() {
        return Session.equals('selectedTask', this._id) ? 'selected' : '';
    };

    Template.box.editing = function() {
        return Session.equals('editTask', this._id) ? 'editing' : '';
    };

    function popTask(id) {
        Tasks.update({_id: id}, {$set: {
            created: getTime(),
            active: false
        }});
        Meteor.call('setFooterHelperReady', function(error, result) {
            console.log('[setFooterHelperReady]', error, result);
        });
    }

    Template.boxes.events({
        'makeSelected .box, mouseenter .box': function(e) {
            if (!Session.equals('selectedTask', this._id) &&
                Session.equals('editTask', null)) {
                Session.set('selectedTask', this._id);
            }
        },
        'keydown div.text, click div.text': function(e) {
            if (e && e.type != 'click' && e.keyCode != 13) return;
            Session.set('editTask', this._id);
        },
        'keydown .edit, blur .edit': function(e) {
            if (e.type == 'keydown') {
                if (e.keyCode == 27) { // esc
                    Session.set('editTask', null);
                    return;
                }
                if (e.keyCode != 13) { // not enter
                    return;
                }
            }

            var newText = $(e.target).val();
            if (!newText && !this.text) {
                Tasks.remove({_id: this._id});
            } else {
                Tasks.update({_id: this._id}, {$set: {text: newText}}); //TODO - error
            }
            Session.set('editTask', null);
        },
        'click a.pop': function(e) {
            e.preventDefault();
            popTask(this._id);
        }
    });

    Template.inactiveBoxes.events({
        'click a.pop': function(e) {
            e.preventDefault();
            Tasks.remove({_id: this._id});
        }
    });

    function numberBoxes() {
        var $boxes = this.findAll('.box'),
            len = $boxes.length;
        _.each($boxes, function(box, i) {
            $(box).find('.num').text(len - i);
        });
    }

    Template.boxes.rendered = function() {
        var editing = this.find('.editing');
        if (editing) {
            $(editing).find('.edit').focus().select();
        }
        numberBoxes.call(this);
    };

    Template.inactiveBoxes.rendered = numberBoxes;

    //
    // Help Modal
    //
    Session.set('showHelpModal', false);

    Template.helpModal.show = function() {
        return Session.get('showHelpModal');
    };

    function nextBox(reverse) {
        //TODO - a reactive way to do this?
        //       or at least to trigger makeSelected
        var $tasks = $('#tasks'),
            $selected = $tasks.find('.selected'),
            $new = ($selected.length ?
                    $selected[reverse?'prev':'next']('.box') :
                    null);
        if (!$new || !$new.size()) {
            $new = $tasks.find('.box')[reverse?'last':'first']();
        }
        Session.set('selectedTask', $new.data('id'));
    };

    // key events
    var keyevents = [
        {
            evt: 'keyup',
            key: 'a',
            fn: function(e) {
                // note - there's a mysterious bug where
                // this gets triggered sometimes on firefox
                // on mac osx when using cmd+tab to switch
                // applications...
                if (!$('#login-dropdown-list').size()) { //HACK - for login
                    addTask();
                }
            },
            help: 'Add a new task'
        },
        {
            evt: 'keypress',
            key: 'j',
            fn: function() { nextBox(); },
            help: 'Select the next task'
        },
        {
            evt: 'keypress',
            key: 'k',
            fn: function() { nextBox(true); },
            help: 'Select the previous task'
        },
        {
            evt: 'keyup',
            key: 'e',
            fn: function() {
                if (!Session.equals('selectedTask', null)) {
                    Session.set('editTask', Session.get('selectedTask'));
                }
            },
            help: 'Edit the selected task'
        },
        {
            evt: 'keyup',
            key: '#',
            fn: function() {
                if (!Session.equals('selectedTask', null)) {
                    var id = Session.get('selectedTask');
                    nextBox();
                    popTask(id);
                }
            },
            help: 'Mark the current task as complete'
        },
        {
            evt: 'keyup',
            key: '?',
            exactKey: 'shift+/',
            fn: function() {
                Session.set(
                    'showHelpModal',
                    !Session.equals('showHelpModal', true)
                );
            },
            help: 'Show the help modal'
        }
    ];

    Template.helpModal.keyevents = function() {
        return keyevents;
    };

    //
    // Shares
    //
    Template.sharesBase.shareUrl = function() {
        return 'http://todostack.meteor.com';
    };


    //
    // Global Key Events
    //
    Meteor.startup(function() {
        var $doc = $(document);

        _.each(keyevents, function(obj) {
            $doc.bind(obj.evt, obj.exactKey || obj.key, obj.fn);
        });

        $doc.bind('keyup', 'esc', function() {
            Session.set('showHelpModal', false);
        });

        // clear the footer helper state
        $('#under').on(
            'click.footerHelper mouseenter.footerHelper',
            function() {
                if (footerHelperState) {
                    var user = Meteor.user();
                    if (user) {
                        Meteor.call('setFooterHelperSeen');
                    }
                }
            }
        );
    });
}

if (Meteor.isServer) {

    Meteor.publish('userTasks', function() {
        return this.userId ?
            Tasks.find({userId: this.userId}) : null;
    });

    Meteor.publish('userData', function() {
        return this.userId ?
            UserData.find({userId: this.userId}) : null;
    });


    Meteor.startup(function() {
        // code to run on server at startup
    });




    Meteor.methods({
        setFooterHelperReady: function() {
            // mark the footer helper as ready to show
            // in UserData if we havent already set it.
            // basically an insert on duplicate key update
            this.unblock();
            var userId = this.userId;
            if (userId) {
                var data = UserData.findOne({userId: userId}) ||
                    UserData.insert({
                        userId: userId,
                        footerHelper: true
                    });
                if (data.footerHelper === undefined) {
                    UserData.update({_id: data._id}, {$set: {
                        footerHelper: true
                    }});
                }
                return data;
            }
            return null;
        },
        setFooterHelperSeen: function() {
            this.unblock();
            var userId = this.userId;
            if (userId) {
                UserData.update({userId: userId}, {$set: {
                    footerHelper: false
                }});
                return true;
            }
            return false;
        },
        fixCreated: function() {
            Tasks.find({}).forEach(function(x) {
                if (!/^\d+$/.test(x.created)) {
                    var t;
                    try {
                        t = (new Date(x.created)).getTime();
                        if (isNaN(t.getTime())) {
                            throw new Error('not a number!');
                        }
                    } catch(e) {
                        t = (new Date).getTime();
                    }
                    Tasks.update({_id: x._id}, {$set: {created: t}});
                };
            });
        }
    });

}


// TODO
//
// *   collaboration
// *   shares?
// *   ga
