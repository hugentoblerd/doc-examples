var app = angular.module('documentManager');

app.controller('documentCtrl', function ($scope, $timeout, $window, documentSrvc, documentFctr, emailFctr, $compile, Flash, $loading) {

  // global variables
  this.recordId = "";
  var URL_S3         = "https://example.s3.amazonaws.com/";
  var URL_DOCUMENT   = "/api/document";
  var URL_SEND_EMAIL = "/api/sendemail";

  $scope.addingTag = true;
  var editing = false;
  var $newTagSelect;

  $scope.pdf_docs = []; 

  // to be run on pg load
  $(function () {
    $('[data-toggle="popover"]').popover();

		window.addEventListener("drop",function(e){
		  e = e || event;
		  if (e.target != $('#files')[0]) {
			  e.preventDefault();
			  $('#upload').removeClass('btn-lg');
	    	$('#upload').children('span').html('Upload');
	    }
		},false);

    // hides tag input field
    $('#tagInput').hide();

    $scope.$parent.$watch("documents", function(newValue, oldValue) {
    	if ($('#table').bootstrapTable()) {
    		$('#table').bootstrapTable('load', $scope.$parent.documents);
    	}else {
	      $('#table').bootstrapTable({
		      data: $scope.$parent.documents,
		      formatNoMatches: function () {
		      	return 'No matching records found. Please add files or refresh the page';
		      }
		    });
	    }
	    // writes isChecked bool on $scope.$parent.documents appropriately on check-all/uncheck-all
	    $('thead input:checkbox').on('change', function (e) {
	      var temp_disabled = $(this).prop('checked');
	      $.each($('tbody input:checkbox'), function (i) {
	        if ($(this).val() === $scope.$parent.documents[i]._id) {
	          $scope.$parent.documents[i].isChecked = this.checked;
	        };
	      })
	      if (!editing) {
	        $.each($('.selected'), function () {
	          this.disabled = !temp_disabled;
	        });
	      }
	    });
	    addListeners();
	  });
	  /* MOVES INTO WATCHER ABOVE */
    // creates table and inserts documents data
    // $('#table').bootstrapTable({
    //   data: $scope.$parent.documents,
    //   formatNoMatches: function () {
    //   	return 'No matching records found. Please add files or refresh the page';
    //   }
    // });

    // selectizes global tag input
    $newTagSelect = $('#newTag').selectize({
    	plugins: ['remove_button'],
	    delimiter: ',',
	    create: true,
	    createOnBlur: true,
	    maxOptions: 3,
		});

    // adds hint for UX
    $('.rename').attr('title', 'rename this file');
    $('.preview').attr('title', 'preview this file');

    /* MOVES INTO WATCHER ABOVE */
    // // writes isChecked bool on $scope.$parent.documents appropriately on check-all/uncheck-all
    // $('thead input:checkbox').on('change', function (e) {
    //   var temp_disabled = $(this).prop('checked');
    //   $.each($('tbody input:checkbox'), function (i) {
    //     if ($(this).val() === $scope.$parent.documents[i]._id) {
    //       $scope.$parent.documents[i].isChecked = this.checked;
    //     };
    //   })
    //   if (!editing) {
    //     $.each($('.selected'), function () {
    //       this.disabled = !temp_disabled;
    //     });
    //   }
    // });

    // enables/disables #save-tags btn based off input val
    $('#tagInput > .selectize-control > .selectize-input > input').bind('change, paste, keyup', function (e) {
      var temp   = $(this).val().trim();
      var newTag = $('#newTag').val().trim();

      if ( (temp && temp.length > 0) || (newTag && newTag.length > 0) ) {
      	$('#save-tags').attr("disabled",false);
      }else {
      	$('#save-tags').attr("disabled",true);
      };
    });

    // convert to pdf - focus on new title input
    $('#reOrderModal').on('shown.bs.modal', function (e) {
		  $('#new-pdf-name').focus();
		});
    
		// instantiates listeners
    addListeners();

    // upload button listener
    $('#files').on('change', handleFileSelect);
    // tag button listener
    $('#add-tags').on('click', addTags);
    // update tag button listener
    $('#save-tags').on('click', updateTags);
    // cancel tag button listener
    $('#cancel-tags').on('click', cancelTags);
    // email button listener
    $('#send-email').on('click', sendEmail);
    // download button listener
    $('#download').on('click', downloadDocs);
    // re-order button listener
    $('#re-order').on('click', reOrderDocs);
    // pdf-convert button listener
    $('#pdf-convert').on('click', convertToPdf);
    // $('#new-pdf-name')
    // download button listener
    $('#delete').on('click', deleteDocs);
  });
    
  /**
   * @property interface
   * @type {Object}
   */
  $scope.interface = {};

  /**
   * @property uploadCount
   * @type {Number}
   */
  $scope.uploadCount = 0;

  /**
   * @property success
   * @type {Boolean}
   */
  $scope.success = false;

  /**
   * @property error
   * @type {Boolean}
   */
  $scope.error = false;

  function addListeners () {
  	// reinstantiates isChecked bool on $scope.$parents.documents[index]
    // enables/disables buttons based on checkbox status
    // put in directive or formatter??
    $('tbody input:checkbox').on('change', function(e) {
      var temp_disabled = false;
      $.each($('tbody input:checkbox'), function (i) {
        // get unique id from parent element
        var temp_id = $(this).parent().parent().attr('data-uniqueid'); 
        // marks "isChecked" bool
        if (temp_id === $scope.$parent.documents[i]._id) {
          $scope.$parent.documents[i].isChecked = this.checked;
        };
        // disable buttons bool
        if (this.checked) {
          temp_disabled = true;
        };
      })
      // disables buttons
      if (!editing) {
        $.each($('.selected'), function () {
          this.disabled = !temp_disabled;
        });
      }
    });
    // reinstantiate rename button listener
    $('.rename').on('click', renameTitle);
    // reinstantiate preview button listener
    $('.preview').on('click', previewFile);
  }

  function handleFileSelect(e) {
    var files = e.target.files; // FileList object
		
		// upload button UI
    $('#upload').removeClass('btn-lg');
    $('#upload').children('span').html('Dropped');

    if (files.length > 0) {
	    // uncheck selected so we can check the files uploaded
	    $('#table').bootstrapTable('uncheckAll');
	    // loading status for UX
	    $('#table').bootstrapTable('showLoading');
	  };

    var upload = null;

    if (files.file) {
        upload = files.file;
    } else {
        upload = files;
    }

    $.each(upload, function (i, file) {
      if ( file.type.substring(0, 5) == 'image' ) {
      	// error message for UX
		    swal({
		    	title : 'Invalid file type!',
		    	text  : 'Image file types are not supported.',
		    	type  : 'error'
		    });
        var message = 'Don\'t forget to tag the documents';
        Flash.create('warning', message);
        // upload button UI
        $('#upload').children('span').html('Upload');
        // add data to table w/o hitting db
        $('#table').bootstrapTable('load', $scope.$parent.documents);
        // checks uploaded files
        $("#table").bootstrapTable("checkBy", {field:"isChecked", values:[true]}
        );
        // loading status for UX
        $('#table').bootstrapTable('hideLoading');
        // reinstantiates listeners
        addListeners();
        return;
      };

      //clear any documents in the filteredDocuments array first
      $scope.$parent.inSearchMode = true;
      $scope.$parent.filteredDocuments.length = 0;
      $scope.$parent.searchData = "";
      $scope.$parent.clearSelected();

      var document = new documentFctr(documentSrvc.recordId, $scope.$parent.documentStatus, file);
      document.localFile = file;
      $scope.$parent.documents.unshift(document);
      documentSrvc.uploadDocument(document).then(function (document) {
          //Update local document objects with newly posted documents from the server
          for (var x = 0; x < $scope.$parent.documents.length; x++) {
            // shorten variable
            var temp_doc = $scope.$parent.documents[x];

            if (temp_doc.documentUrl === document.documentUrl) {
              $scope.$parent.documents[x] = document;
              $scope.$parent.documents[x].isChecked = true;
              // makes tags searchable on table
			        temp_tags = $scope.$parent.documents[x].tags.join(', ');
			        $scope.$parent.documents[x].tags_str = temp_tags;
              // adds button for rename and preview
              $scope.$parent.documents[x].actions = '<button class="btn btn-sm btn-warning rename"><i class="glyphicon glyphicon-pencil"></i><button class="btn btn-sm btn-success preview"><i class="glyphicon glyphicon-eye-open"></i>';
              //Add to filter and show only filter
              $scope.$parent.filteredDocuments.unshift(document);
            }

            //Make sure to update tags after a document is uploaded
            $scope.$parent.initTagsForDocument(temp_doc);
          }
          $scope.$parent.updateTagCounts();

          // success message for UX
          var message = '<strong>Successfully</strong> uploaded files!';
          Flash.create('success', message);

          // upload button UI
          $('#upload').children('span').html('Upload');
          // add data to table w/o hitting db
          $('#table').bootstrapTable('load', $scope.$parent.documents);
          // checks uploaded files
          $("#table").bootstrapTable("checkBy", {field:"isChecked", values:[true]}
          );
          // loading status for UX
          $('#table').bootstrapTable('hideLoading');
          // reinstantiates listeners
          addListeners();

          // because uploaded files will be checked, activate buttons
          $.each($('.selected'), function () {
              this.disabled = false;
          })

      }, function (err) {
        var message = '<strong>Failed</strong> to upload files!';
        Flash.create('danger', message);
        // loading status for UX
        $('#table').bootstrapTable('hideLoading');
        // upload button UI
        $('#upload').children('span').html('Upload');
      });
      if ($scope.$parent.alerts.length == 0) {
        var message = 'Don\'t forget to tag the documents';
        Flash.create('warning', message);
      }
    })
  }

  function addTags (e) {
    // disables buttons and search area
    $('.btn, input:text').attr("disabled","disabled");
    // restyles cursor on toolbar
    $('.fixed-table-toolbar').css('cursor', 'not-allowed');
    // enables new tag input and buttons
    $('#cancel-tags, #newTag').attr("disabled",false);
    $('#tagInput > .selectize-control > .selectize-input > input').trigger('change');
    $newTagSelect[0].selectize.unlock();
    $newTagSelect[0].selectize.enable();

    // shows new tag input and buttons
    $('#tagInput').show(400,function () {
        $newTagSelect[0].selectize.focus();
    });

    if (!editing) {
    	// 
	    $.each($('td.tags'), function (i, row) {
	    	if ($(row).html() === '-') {
	    		temp_val = '';
	    	}else {
	    		temp_val = $(row).html();
	    	}
	    	$(row).html('<input class="tags" type="text" value="' + temp_val + '"/>')
	    });
	    var $tagsSelect = $('input.tags').selectize({
	    	plugins: ['remove_button'],
		    delimiter: ',',
		    create: true,
		    createOnBlur: true,
		    maxOptions: 3,
			});
			$.each($('input.tags'), function (i) {
				$tagsSelect[i].selectize.on('item_add', updateOneTag);
				$tagsSelect[i].selectize.on('item_remove', deleteOneTag);
			});
		};

		editing = true;
  }
  function updateTags (e) {
    var temp_updated = false;
    var temp_str     = $('#newTag').val();
    var temp_tags    = temp_str.split(/[ ,]+/);
    var temp_docs    = $scope.$parent.documents;

    if (temp_str == '' || temp_str.length === 0 || !temp_str.trim()) {
      cancelTags();
      var message = '<strong>Could not update tags.</strong> No tags found in selection.';
      Flash.create('warning', message);
      return;
    };

    $.each(temp_docs, function (i, temp_doc) {
      if (temp_doc.isChecked) {
        temp_updated = true;
        // push new tags to each checked document
        $.each(temp_tags, function (i, tag) {
          if ($.inArray(tag, temp_doc.tags) === -1) {
            temp_doc.tags.push(tag);
            if (temp_doc.tags.length > 1) {
			      	temp_doc.tags_str = temp_doc.tags_str.concat(', ', tag);
			      }else {
			      	temp_doc.tags_str = temp_doc.tags_str.concat(tag);
			      }
          }
        });

        // formats document for update
        var document = new documentFctr(temp_doc.recordId, '', temp_doc);
        // 
        documentSrvc.updateDocument(document).then(function (newDocument) {
          document = newDocument;
          // UX message
          var message = '<strong>Successfully updated tags.</strong>';
          Flash.create('success', message);
        }, function (err) {
          console.error("Could not update tags:", err);
          // UX message
          var message = '<strong>Could not update tags.</strong> Please refresh and try again.';
          Flash.create('danger', message);
        });
      };
    });
		$scope.$parent.documents = temp_docs;

    // error message if no checkboxes are checked
    if (temp_updated) {
    	// add data to table w/o hitting db
	    $('#table').bootstrapTable('load', temp_docs);

	    addListeners();
	    cancelTags();
	  }else {
	  	addTags();
      var message = '<strong>No files selected.</strong> Please select files to update tags.';
      Flash.create('warning', message);
      return;
	  };
  };
  function updateOneTag (newTag, el) {
  	var temp_id = el.parent().parent().parent().parent().attr('data-uniqueid');
  	var temp_i;
  	var temp_doc;
  	$.each($scope.$parent.documents, function (i) {
  		if (this._id === temp_id) {
  			temp_i   = i;
  			temp_doc = this;
  		};
  	})

    if (newTag == '' || newTag.length === 0 || !newTag.trim()) {
      var message = '<strong>Could not update tags.</strong> No tags found in selection.';
      Flash.create('warning', message);
      return;
    };

    if ( $.inArray(newTag.trim(), temp_doc.tags) !== -1 ) {
			var message = '<strong>Cannot save tag!</strong> <u>' + newTag + '</u> is a duplicate tag.';
      Flash.create('danger', message);
			$('input.tags').selectize()[temp_i].selectize.removeItem(newTag);  
    }else {

      // push new tag to document
      temp_doc.tags.push(newTag);
      if (temp_doc.tags.length > 1) {
      	temp_doc.tags_str = temp_doc.tags_str.concat(', ', newTag);
      }else {
      	temp_doc.tags_str = temp_doc.tags_str.concat(newTag);
      }
      // formats document for update
      var document = new documentFctr(temp_doc.recordId, '', temp_doc);
      // updates document
      documentSrvc.updateDocument(document).then(function (newDocument) {
        document = newDocument;
        // UX message
        var message = '<strong>Successfully added tag.</strong>';
        Flash.create('success', message);
      }, function (err) {
        console.error("Could not add tag:", err);
        // UX message
        var message = '<strong>Could not add tag.</strong> Please refresh and try again.';
        Flash.create('danger', message);
      });
    };
    
    // add data to table w/o hitting db
    $('#table').bootstrapTable('load', temp_doc);

    addListeners();

    // 
    $.each($('td.tags'), function (i, row) {
    	temp_val = $(row).html();
    	$(row).html('<input class="tags" type="text" value="' + temp_val + '"/>')
    });
    var $tagsSelect = $('input.tags').selectize({
    	plugins: ['remove_button'],
	    delimiter: ',',
	    create: true,
	    createOnBlur: true,
	    maxOptions: 3,
		});
		$.each($('input.tags'), function (i) {
			$tagsSelect[i].selectize.on('item_add', updateOneTag);
			$tagsSelect[i].selectize.on('item_remove', deleteOneTag);
		});
		$('input.tags').selectize()[temp_i].selectize.focus();
  }
  function deleteOneTag (oldTag, el) {
  	var temp_docs = $scope.$parent.documents;
  	var temp_id;
  	var temp_i;
  	var old_i;
  	oldTag = oldTag.trim();

  	$.each($('input.tags'), function (i, temp_input) {
  		if ($(temp_input).val() !== temp_docs[i].tags_str) {
  			temp_i = i;
  			temp_id = $(temp_input).parent().parent().attr('data-uniqueid');
  		};
		});

		old_i = temp_docs[temp_i].tags.indexOf(oldTag);

    // splice old tag from document tags and reset tags string
    temp_docs[temp_i].tags.splice(old_i, 1);
    temp_docs[temp_i].tags_str = temp_docs[temp_i].tags.join(', ');

    // formats document for update
    var document = new documentFctr(temp_docs[temp_i].recordId, '', temp_docs[temp_i]);
    // 
    documentSrvc.updateDocument(document).then(function (newDocument) {
      document = newDocument;
      // UX message
      var message = '<strong>Successfully deleted tag.</strong>';
      Flash.create('success', message);
    }, function (err) {
      console.error("Could not delete tag:", err);
      // UX message
      var message = '<strong>Could not delete tag.</strong> Please refresh and try again.';
      Flash.create('danger', message);
    });
    
    // add data to table w/o hitting db
    $('#table').bootstrapTable('load', temp_docs);
    // reinstantiate table listeners
    addListeners();

    // 
    $.each($('td.tags'), function (i, row) {
    	temp_val = $(row).html();
    	$(row).html('<input class="tags" type="text" value="' + temp_val + '"/>')
    });
    var $tagsSelect = $('input.tags').selectize({
    	plugins: ['remove_button'],
	    delimiter: ',',
	    create: true,
	    createOnBlur: true,
	    maxOptions: 3,
		});
		$.each($('input.tags'), function (i) {
			$tagsSelect[i].selectize.on('item_add', updateOneTag);
			$tagsSelect[i].selectize.on('item_remove', deleteOneTag);
		});
		$('input.tags').selectize()[temp_i].selectize.focus();
  }
  function cancelTags (e) {
    // enables buttons and search box
    $('.btn, input:text').attr("disabled", false);
    // resets cursor for toolbar buttons
    $('.fixed-table-toolbar').css('cursor', 'default');
    // hides new tag input and buttons
    $('#tagInput').hide(400, function () {
      // resets new tag input
      $newTagSelect[0].selectize.clearOptions()
    });
    // 
    $.each($('input.tags'), function (i, row) {
    	temp_tags = $(row).val();
    	$(row).parent().html(temp_tags);
    });
    editing = false;
    $('tbody input:checkbox').trigger('change');
  };

  $scope.bucketUrl = function () {
    return documentSrvc.getBucketURL();
  };

  /**
   * creates UX input field for renaming files
   * @return {void} 
   */
  function renameTitle () {
    var temp_this = $(this).parent().siblings('.file-name');
    var temp_name = $(this).parent().siblings('.file-name').html();
    var temp_id   = $(this).parent().parent().attr('id');
    var temp_tags = $(this).parent().siblings('.tags');
    // for card view on mobile
    if (!temp_id) {
    	temp_id = $(this).parent().parent().parent().parent().attr('id');
    };
    // disables buttons for UX
    $('.btn').attr("disabled","disabled");
    editing = true;

    // selectizes tags for easy editing
  	if (temp_tags.html() === '-') {
  		temp_val = '';
  	}else {
  		temp_val = temp_tags.html();
  	}
  	temp_tags.html('<input class="tags" type="text" value="' + temp_val + '"/>')
    var $tagsSelect = $('input.tags').selectize({
    	plugins: ['remove_button'],
	    delimiter: ',',
	    create: true,
	    createOnBlur: true,
	    maxOptions: 3,
		});
		$.each($('input.tags'), function (i) {
			$tagsSelect[i].selectize.on('item_add', updateOneTag_rename);
			$tagsSelect[i].selectize.on('item_remove', deleteOneTag_rename);
		});

    // creates & selects input to edit title
    temp_this.html('<input type="text" class="form-control" id="rename_' + temp_id + '" value="' + temp_name + '"><button class="btn btn-sm btn-danger rename_cancel pull-right"><i class="glyphicon glyphicon-remove"></i><button class="btn btn-sm btn-success rename_save pull-right" disabled><i class="glyphicon glyphicon-ok"></i>');
    temp_this.children('input').select();

    // enables/disables .rename_save btn based off input val
    $('#rename_' + temp_id).bind('change, paste, keyup', function (e) {
      var new_name = $('#rename_' + temp_id).val();

      if ( temp_name !== new_name ) {
      	$('.rename_save').attr("disabled",false);
      }else {
      	$('.rename_save').attr("disabled",true);
      };
    });

    // save rename button listener
    $('.rename_save').on('click', {id: temp_id}, updateTitle);
    // cancel rename button listener
    $('.rename_cancel').on('click', {id: temp_id, orig_name: temp_name}, cancelRename);
  }
  /**
   * takes renamed file and updates db record
   * deletes input and restores table with new name
   * @param  {obj} e - event
   * @return {void}
   */
  function updateTitle (e) {
    // gets document from scope
    var temp_doc = $.grep($scope.$parent.documents, function (n, i) {
      return n._id === e.data.id;
    })
    temp_doc = temp_doc[0];
    // gets old name from document
    var old_name = temp_doc.title;
    // gets new name from input
    var new_name = $('#rename_' + e.data.id).val();
    // replaces old name with new in title
    temp_doc.title = new_name;
    // formats document for
    var document = new documentFctr(temp_doc.recordId, '', temp_doc);
    // 
    documentSrvc.updateDocument(document).then(function (newDocument) {
      document = newDocument;
      // UX message
      var message = '<strong>Successfully updated document.</strong>';
      Flash.create('success', message);
      // replaces input & buttons with new name
      $('#' + e.data.id).children('.file-name').html(new_name);
      // replaces tag input with string of tags
	    $.each($('input.tags'), function (i, row) {
	    	temp_tags = $(row).val();
	    	$(row).parent().html(temp_tags);
	    });
      // enables buttons
      $('.btn').attr("disabled", false);
      editing = false;
      $('table input:checkbox').trigger('change');
    }, function (err) {
      console.error("Could not update document");
      // UX message
      var message = '<strong>Could not update document.</strong> Please refresh and try again.';
      Flash.create('danger', message);
      // replaces input & buttons with old name
      $('#' + e.data.id).children('.file-name').html(old_name);
      // replaces tag input with string of tags
	    $.each($('input.tags'), function (i, row) {
	    	temp_tags = $(row).val();
	    	$(row).parent().html(temp_tags);
	    });
      // enables buttons
      $('.btn').attr("disabled", false);
      editing = false;
      $('table input:checkbox').trigger('change');
    });
  };
  /**
   * cancels input and restores table with original name
   * @param  {obj} e - event
   * @return {void}
   */
  function cancelRename (e) {
    // replaces title input & buttons with original name
    $('#' + e.data.id).children('.file-name').html(e.data.orig_name);
    // replaces tag input with string of tags
    $.each($('input.tags'), function (i, row) {
    	temp_tags = $(row).val();
    	$(row).parent().html(temp_tags);
    });
    // enables buttons
    $('.btn').attr("disabled", false);
    editing = false;
    $('table input:checkbox').trigger('change');
  };
  function updateOneTag_rename (newTag, el) {
  	var temp_id = el.parent().parent().parent().parent().attr('data-uniqueid');
  	var temp_i;
  	var temp_doc;
  	$.each($scope.$parent.documents, function (i) {
  		if (this._id === temp_id) {
  			temp_i   = i;
  			temp_doc = this;
  		};
  	});

    if (newTag == '' || newTag.length === 0 || !newTag.trim()) {
      var message = '<strong>Could not update tags.</strong> No tags found in selection.';
      Flash.create('warning', message);
      return;
    };    

    if ( $.inArray(newTag.trim(), temp_doc.tags) !== -1 ) {
			var message = '<strong>Cannot save tag!</strong> <u>' + newTag + '</u> is a duplicate tag.';
      Flash.create('danger', message);
			$('input.tags').selectize()[temp_i].selectize.removeItem(newTag);  
    }else {

      // push new tag to document
      temp_doc.tags.push(newTag);
      if (temp_doc.tags.length > 1) {
      	temp_doc.tags_str = temp_doc.tags_str.concat(', ', newTag);
      }else {
      	temp_doc.tags_str = temp_doc.tags_str.concat(newTag);
      }
      // formats document for update
      var document = new documentFctr(temp_doc.recordId, '', temp_doc);
      // updates document
      documentSrvc.updateDocument(document).then(function (newDocument) {
        document = newDocument;
        // UX message
        var message = '<strong>Successfully added tag.</strong>';
        Flash.create('success', message);
      }, function (err) {
        console.error("Could not add tag:", err);
        // UX message
        var message = '<strong>Could not add tag.</strong> Please refresh and try again.';
        Flash.create('danger', message);
      });
    };
		
		// refocus selectize input
		$('input.tags').selectize()[0].selectize.focus();
  }
  function deleteOneTag_rename (oldTag, el) {
  	var temp_docs = $scope.$parent.documents;
  	var temp_doc;
  	var temp_id = $($('input.tags')).parent().parent().attr('data-uniqueid');
  	var old_i;
  	oldTag = oldTag.trim();

		// get temp_doc by temp_id
		$.each(temp_docs, function (i) {
			if (this._id === temp_id) {
				temp_doc = this;
			};
		})

		old_i = temp_doc.tags.indexOf(oldTag);

    // splice old tag from document tags and reset tags string
    temp_doc.tags.splice(old_i, 1);
    temp_doc.tags_str = temp_doc.tags.join(' , ');

    // formats document for update
    var document = new documentFctr(temp_doc.recordId, '', temp_doc);

    // 
    documentSrvc.updateDocument(document).then(function (newDocument) {
      document = newDocument;
      // UX message
      var message = '<strong>Successfully deleted tag.</strong>';
      Flash.create('success', message);
    }, function (err) {
      console.error("Could not delete tag:", err);
      // UX message
      var message = '<strong>Could not delete tag.</strong> Please refresh and try again.';
      Flash.create('danger', message);
    });
    
    // refocus selectize input
		$('input.tags').selectize()[0].selectize.focus();
  }

  /**
   * opens file preview using an iframe and Google Docs
   * @return {void}
   */
  function previewFile () {
    var temp_this = $(this).parent().siblings('.file-name');
    var temp_id   = $(this).parent().parent().attr('id');
    // for card view on mobile
    if (!temp_id) {
    	temp_id = $(this).parent().parent().parent().parent().attr('id');
    };

    // gets document from scope
    var temp_doc = $.grep($scope.$parent.documents, function (n, i) {
      return n._id === temp_id;
    })
    temp_doc = temp_doc[0];

    // insert iframe and open preview in modal window
    $('#previewModal .modal-body').html('<iframe class="doc" src="http://docs.google.com/viewer?url=' + URL_S3 + temp_doc.documentUrl + '&embedded=true"></iframe>')
    $('#previewModal').modal();
  }

  $scope.emailField;
  $scope.emailSubject;
  $scope.emailDescription;

  function sendEmail (e) {
    // TODO -  If there are no emails or if the emails are improperly formatted throw an error to the user and do not continue
    var emailField       = $('#emailField').val();
    var emailSubject     = $('#emailSubject').val();
    var emailDescription = $('#emailDescription').val();

    var documentHolder = [];
    for (var x = 0; x < $scope.$parent.documents.length; x++) {
      var p = $scope.$parent.documents[x];
      if (p.isChecked) {
        documentHolder.push(p.documentUrl);
      }
    }
    var email = new emailFctr(emailField, documentHolder, emailSubject, emailDescription);
    if (documentSrvc.sendEmail(email)) {
    	// success message for UX
      var message = '<strong>Success!</strong> Files successfully emailed';
      Flash.create('success', message);
    }else {
    	// failure message for UX
      var message = '<strong>Failure!</strong> Files were NOT emailed';
      Flash.create('danger', message);
    };
  };

  //reset email modal function
  $scope.reset = function () {
    $scope.emailField = '';
    $scope.emailSubject = '';
    $scope.emailDescription = '';
  }

  /**
   * sorts docs by date, re-orders docs on user input and sets to $scope
   * @return {arr} - $scope.pdf_docs
   */
  function reOrderDocs () {
  	var temp_docs   = $scope.$parent.documents;
  	$scope.pdf_docs = [];
  	var new_docs    = [];
  	var j           = 0;
  	// modal listeners
    $('#reOrderModal').on('hidden.bs.modal', function (e) {
		  $('.re-arrange').sortable('destroy');
		  $('.pdf-pg, .re-arrange').html('');
		  $('#new-pdf-name').val('');
		});
		// assign checked docs to new arr
		$.each(temp_docs, function(i) {
      if (this.isChecked) {
      	$scope.pdf_docs.push(this);
      }
   	});
   	// re-sort documents by asc date
  	$scope.pdf_docs.sort(function(a, b) { 
	    return new Date(a.date).getTime() - new Date(b.date).getTime() 
		});
    // append selected documents to modal for re-arranging
  	$.each($scope.pdf_docs, function(i) {
    	j += 1;
    	$('.pdf-pg').append('<li class="list-group-item list-group-item-primary">' + j);
    	$('.re-arrange').append('<li class="list-group-item list-group-item-primary" data-id="' + this._id + '"><strong>' + this.title);
   	});
   	// re-arrange pdf_docs arr on user input
    $('.re-arrange').sortable().bind('sortupdate', function() {
    	new_docs = [];
    	$('.re-arrange').children('li').each(function (i, new_doc) {
    		temp_id = $(new_doc).data('id');
    		$.each($scope.pdf_docs, function (j, orig_doc) {
    			if (temp_id === orig_doc._id) {
    				new_docs.push(orig_doc);
	    		};
    		})    		
    	})
    	$scope.pdf_docs = new_docs;
		});
  };
  /**
   * validates a title to exclude invalid characters and replace spaces with dashes
   * @return {bool}
   */
  function validateTitle() {
  	var temp_title  = $('#new-pdf-name').val();
  	var spaces      = /\s/g;
  	var new_title 	= '';
  	var has_symbols = false;
  	if (temp_title.trim() == null || temp_title.trim() == '') {
  		return false
  	}
  	new_title 	= temp_title.replace(spaces, '-');
  	has_symbols = /[!$%^&*()+|~=`{}\[\]:";'<>?,.\/]/.test(new_title);
    if (new_title == null || new_title == '' || new_title.length > 31 || has_symbols) {
      return false;
    }
    $('#new-pdf-name').val(new_title);
    return true;
  }
  /**
   * sends selected files to server for pdf conversion
   * @return {bool} converted - if pdf conversion is successful
   */
  function convertToPdf () {
  	if (!validateTitle()) {
  		// info message for UX
	    swal({
	    	title : 'Invalid file name!',
	    	text  : '" #< >$+,( )%!`&;*‘|.{ }?“=/ : \[ ]@ " are not allowed in file name <br> and file names can\'t be longer than 31 characters. <br> Please rename your file.',
	    	html  : true,
	    	type  : 'warning'
	    });
  	}else {
	  	var docs      = $scope.pdf_docs;
	  	var temp_id   = { recordId: docs[0].recordId };
	  	var converted = false;
	  	var j         = 0;
	  	$('#reOrderModal').modal('hide');
	  	// info message for UX
	    var message = 'It may take a few minutes to convert your files to PDF...';
	    Flash.create('info', message);
	    // disables user input and displays spinner for UX
	  	$('.dw-loading-overlay').addClass('overlayed');
	  	$loading.start('converting-pdf');
	  	// deletes and pdf files in users folder on server
	  	documentSrvc.deletePdfs(temp_id).then(function (deleted) {
		    $.each(docs, function (i) {
		    	// sets the name of converted pdf file to docs[i] object
		    	if ($('#new-pdf-name').val().trim() == '' || $('#new-pdf-name').val() == undefined) {
			    	docs[i].renamed = 'merged.pdf';
			    }else {
			    	if ($('#new-pdf-name').val().lastIndexOf('.pdf') !== -1) {
			    		docs[i].renamed = $('#new-pdf-name').val().trim();
			    	}else {
			    		docs[i].renamed = $('#new-pdf-name').val().trim() + '.pdf';
			    	};
			    }
		    	// writes each file to server
		    	documentSrvc.writeFile(docs[i]).then(function (written) {
		  			// converts each file to pdf
		  			documentSrvc.convertToPdf(docs[i]).then(function (converted) {
		  				// waits until each file returns promise before calling mergePdf()
		  				j += 1;
		  				if (converted && j === docs.length) {
		  					mergePdf(docs);
		  				};
		  			}, function (err) {
		  				// enables user input and hides spinner for UX
							$loading.finish('converting-pdf');
							$('.dw-loading-overlay').removeClass('overlayed');
							// failure message for UX
				      var message = '<strong>Failed</strong> to convert to PDF! Please refresh and try again';
				      Flash.create('danger', message);
		  			})
		    	}, function (err) {
		    		// enables user input and hides spinner for UX
						$loading.finish('converting-pdf');
						$('.dw-loading-overlay').removeClass('overlayed');
						// failure message for UX
			      var message = '<strong>Failed</strong> to convert all files to PDF! Please refresh and try again';
			      Flash.create('danger', message);
		    	});
		    })
	  	}, function (err) {
	  		// enables user input and hides spinner for UX
				$loading.finish('converting-pdf');
				$('.dw-loading-overlay').removeClass('overlayed');
				// failure message for UX
	      var message = '<strong>Failed</strong> to convert to PDF!';
	      Flash.create('danger', message);
	  	})
	  }
  };
  /**
   * merges converted pdf's into one
   * @param  {arr} docs - arr of file objects
   * @return {bool} merged - then downloads to user's comp
   */
  function mergePdf (docs) {
  	// merges all converted pdf documents
		documentSrvc.mergePdf(docs).then(function (merged) {
			documentSrvc.writeToAws(docs[0]).then(function (document) {

				$scope.$parent.documents.unshift(document);
        //Update local document objects with newly posted documents from the server
        for (var x = 0; x < $scope.$parent.documents.length; x++) {
          // shorten variable
          $scope.$parent.documents[x].isChecked = false;

          if ($scope.$parent.documents[x].documentUrl === document.documentUrl) {
            $scope.$parent.documents[x] = document;
            $scope.$parent.documents[x].isChecked = true;
            // adds button for rename and preview
            $scope.$parent.documents[x].actions = '<button class="btn btn-sm btn-warning rename"><i class="glyphicon glyphicon-pencil"></i><button class="btn btn-sm btn-success preview"><i class="glyphicon glyphicon-eye-open"></i>';
            //Add to filter and show only filter
            $scope.$parent.filteredDocuments.unshift(document);
          }

          //Make sure to update tags after a document is uploaded
          $scope.$parent.initTagsForDocument($scope.$parent.documents[x]);
        }
        $scope.$parent.updateTagCounts();

        // add data to table w/o hitting db
        $('#table').bootstrapTable('load', $scope.$parent.documents);
        // unchecks merged files and checks uploaded files
  			$('#table').bootstrapTable('uncheckAll');
        $("#table").bootstrapTable("checkBy", {field:"isChecked", values:[true]}
        );
        // loading status for UX
        $('#table').bootstrapTable('hideLoading');
        // reinstantiates listeners
        addListeners();

        // because uploaded files will be checked, activate buttons
        $.each($('.selected'), function () {
            this.disabled = false;
        })
			}, function (err) {
				// enables user input and hides spinner for UX
				$loading.finish('converting-pdf');
				$('.dw-loading-overlay').removeClass('overlayed');
				// failure message for UX
	      var message = '<strong>Failed</strong> to write files to CirrusDocs! Please upload the downloaded pdf manually';
	      Flash.create('warning', message);
			})
			// opens/downloads merged pdf file on server
			$window.open('/documentmanager/' + docs[0].recordId + '/' + docs[0].renamed);
			// enables user input and hides spinner for UX
			$loading.finish('converting-pdf');
			$('.dw-loading-overlay').removeClass('overlayed');
			// success message for UX
      var message = '<strong>Successfully</strong> converted files to PDF!';
      Flash.create('success', message);
		}, function (err) {
			// enables user input and hides spinner for UX
			$loading.finish('converting-pdf');
			$('.dw-loading-overlay').removeClass('overlayed');
			// failure message for UX
      var message = '<strong>Failed</strong> to convert to PDF! Please refresh and try again';
      Flash.create('danger', message);
		})
  }

  function deleteDocs () {
    var temp_docs = $scope.$parent.documents;
    var deleted_ids = [];
    swal({
      title: 'Are you sure?',   
      text: 'You will not be able to recover the file(s)!',   
      type: 'warning',   
      showCancelButton: true,   
      confirmButtonColor: '#DD6B55',   
      confirmButtonText: 'Yes, delete it!',   
      cancelButtonText: 'No, cancel please!',   
      closeOnConfirm: false,   
      closeOnCancel: false
    },
    function(isConfirm){
      if (isConfirm) {
        $.each($('tbody input:checkbox'), function(i, a) {
          temp_id = $(this).parent().parent().attr('data-uniqueid');
          if (temp_id === temp_docs[i]._id && temp_docs[i].isChecked) {
            documentSrvc.deleteDocument(temp_docs[i]);
            deleted_ids.push(temp_id); 
          }
        });
        $('#table').bootstrapTable('remove', {field: '_id', values: deleted_ids});
        $.each($('.selected'), function () {
          this.disabled = !this.disabled;
        });
        swal('Deleted!', 'The file(s) has been deleted.', 'success');
        // reinstantiates listeners
        addListeners();
      } else {
        swal('Cancelled', 'The file(s) is safe :)', 'error');
      }
    });
  };

  /**
   * gets checked documents from AWS_S3 as string and converts in to appropriate filetype and downloads to local machine
   * @return void 
   */
  function downloadDocs () {
  	// shows spinnner for UX
  	$('#download-group').children('i').addClass('fa fa-spinner fa-pulse');
  	$('#download-group').children('i').removeClass('glyphicon glyphicon-cloud-download');
    var docs = $scope.$parent.documents;
    $.each($('tbody input:checkbox'), function(i) {
      if ($(this).val() === docs[i]._id && docs[i].isChecked) {
				// pass to service to download from AWS_S3
        documentSrvc.xmlHttpDocuments(docs[i]).then(function (document) {
          // use downloadjs to convert blob into appropriate file and download
          download(document, docs[i].title, docs[i].type);
          // hides spinnner for UX
          $('#download-group').children('i').removeClass('fa fa-spinner fa-pulse');
          $('#download-group').children('i').addClass('glyphicon glyphicon-cloud-download');
          // success message for UX
          var message = '<strong>Successfully</strong> downloading files!';
          Flash.create('success', message);
        }, function (err) {
        	console.log(err, docs[i]);
          // failure message for UX
          var message = '<strong>Failed</strong> to download files!';
          Flash.create('danger', message);
        });
      };
    })
  };

  $scope.showAllFiles = function () {
    $scope.$parent.filteredDocuments.length = 0;
    $scope.$parent.inSearchMode = false;
    $scope.$parent.searchData = "";
    $scope.$parent.closeAlert(0);
  };

  $scope.getExtension = function (input) {
    var fileExtPeriodIndex = input.search(/[.][a-z0-9]*$/);
    var output = input.slice(fileExtPeriodIndex + 1);
    return output;
  };

  $scope.isImageFile = function (input) {
    var knownImgTypes = ['png', 'jpg', 'gif', 'svg'];
    if (knownImgTypes.indexOf(input) === -1) {
      return false;
    }
    return true;
  };


});




