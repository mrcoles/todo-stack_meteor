// Questions
//
// *   seems like I have to put extra js logic into rendered
//     is that the right way to do it?
// *   multiple events...

Tasks = new Meteor.Collection('tasks');

if (Meteor.isClient) {

    //
    // Help Arrow
    //
    Template.helpArrow.show = function() {
        return Session.get('noBoxes');
    };

    Meteor.startup(function() {
        $('#add-task').click(function(e) {
            e.preventDefault();
            var task = Tasks.insert({
                text: 'this is a task',
                created: (new Date()).toGMTString(),
                active: true
            });
            console.log('task', task, task._id); //REM
            Session.set('selectedTask', task._id);
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

    Template.boxes.events({
        'mouseenter .box': function(e) {
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
            Tasks.update({_id: this._id}, {$set: {
                created: (new Date()).toGMTString(),
                active: false
            }});
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
    Template.helpModal.show = function() {
        return Session.get('showHelpModal');
    };


    //
    // Global Key Events
    //
    Meteor.startup(function() {
        
    });
}

if (Meteor.isServer) {
    Meteor.startup(function() {
        // code to run on server at startup
    });
}
