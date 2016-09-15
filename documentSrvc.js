var app = angular.module('documentManager');

app.service('documentSrvc', function ($http, securityFctr, $q, Upload, documentFctr) {

  var self = this; 
  this.recordId = '';
  var URL_S3             = 'https://example.s3.amazonaws.com/'
  var URL_DOCUMENT       = '/api/document';
  var URL_SEND_EMAIL     = '/api/sendemail';
  var URL_WRITE_FILE     = '/api/writefile';
  var URL_CONVERT_TO_PDF = '/api/converttopdf';
  var URL_MERGE_PDF 		 = '/api/mergepdf';
  var URL_WRITE_AWS			 = '/api/writetoaws';
  var URL_DELETE_PDF		 = '/api/deletepdfs';

  this.getBucketURL = function () {
    return URL_S3;
  };

  this.uploadDocument = function (document) {
    var defer = $q.defer();
    $http.get('/api/s3Policy?mimeType=' + document.localFile.type).success(function (response) {
      var s3Params = response;

      //Files are structured differently on live vs local and so we need to do checks
      var type = document.localFile.type ? document.localFile.type : document.localFile.mimeType;

      if (!type) {
        type = 'application/octet-stream';
      }

      Upload.upload({
        url: URL_S3,
        method: 'POST',
        transformRequest: function (data, headersGetter) {

          var headers = headersGetter();
          delete headers['Authorization'];
          return data;
        },
        data: {
          'Key': document.documentUrl,
          'acl': 'public-read',
          'Content-Type': type,
          'AWSAccessKeyId': s3Params.AWSAccessKeyId,
          'success_action_status': '201',
          'Policy': s3Params.s3Policy,
          'Signature': s3Params.s3Signature
        },
        file: document.localFile,
      }).success(function (data, status, headers, config) {

        self.postDocumentRecord(document, function (document) {
          defer.resolve(document);
        }, function (err) {
          defer.reject(err);
        });
      }).error(function (data, status, headers, config) {
        defer.reject(data);
        console.log('error status: ' + status);
        console.log('error data: ' + data);
      });

    });

    return defer.promise;
  };

  this.updateDocument = function (document) {
    var defer = $q.defer();
    $http.put(URL_DOCUMENT + '/' + document._id, document).success(function (data) {
      defer.resolve(data);
    }).error(function (err) {
      defer.reject(err);
    });

    return defer.promise;
  };

  this.postDocumentRecord = function (document, callback, errCallback) {
    $http.post(URL_DOCUMENT, document).success(function (data) {
      console.log('BOOYA');
      callback(data);
    }).error(function (err) {
      console.log('HMMMM:', err);

      errCallback(err);
    });
  };

  this.deleteDocument = function (document) {
    var defer = $q.defer();
    if (document._id) {
      $http.delete(URL_DOCUMENT + '/' + document._id).success(function (data) {
        defer.resolve(data);
        console.log('Deleted document');
      }).error(function (err) {
        defer.reject(err);
        console.log(err);
      });
      return defer.promise;
    }
  };

  this.getDocumentsByStatus = function (status) {
    var defer = $q.defer();
    $http.get(URL_DOCUMENT + '/' + self.recordId + '/' + status).success(function (data) {
      console.log('Downloaded documents: ', data);
      defer.resolve(data);
    }).error(function (err) {
      defer.reject(err);
    });

    return defer.promise;
  };

  this.getDocuments = function () {
    var defer = $q.defer();
    var temp_tags = '';
    $http.post(URL_DOCUMENT + '/' + self.recordId).success(function (data) {

      for (var i = 0; i < data.length; i++) {

      	// reformats date for UX
      	var temp_date = new Date(data[i].date);
      	temp_year = temp_date.getFullYear();
      	temp_hours = temp_date.getHours();
      	if (temp_hours >= 12 && temp_hours != 24) {
      		temp_m = 'PM';
      	}else {
      		temp_m = 'AM';
      	};
      	if (temp_hours > 12) {
      		temp_hours = temp_hours - 12;
      	};
      	data[i].date_str = temp_date.getMonth() + 1 + '/' + temp_date.getDay() + '/' + temp_year + ' ' + temp_hours + ':' + temp_date.getSeconds() + temp_m;

        // makes tags searchable on table
        temp_tags = data[i].tags.join(', ');
        data[i].tags_str = temp_tags;

        // adds button for rename and preview
        data[i].actions = '<button class="btn btn-sm btn-warning rename"><i class="glyphicon glyphicon-pencil"></i><button class="btn btn-sm btn-success preview"><i class="glyphicon glyphicon-eye-open"></i>';

        // save to potentially add in the future??
        // adds glyphicon for folders and files
        // if (data[i].type === 'file') {
        //   data[i].type_image = '<i class="glyphicon glyphicon-file"></i>'
        // } else if (data[i].type === 'dir') {
        //   data[i].type_image = '<i class="glyphicon glyphicon-folder-close"></i>'
        // };

      };

      console.log('Downloaded documents: ', data);
      defer.resolve(data);
    }).error(function (err) {
      defer.reject(err);
    });

    return defer.promise;
  }

  this.sendEmail = function (email) {
    var defer = $q.defer();
    $http.post(URL_SEND_EMAIL, email).success(function (data) {
      console.log('SUCCESS:', data);

      defer.resolve(data);

    }).error(function (err) {
      console.log('FAILURE', err);
      defer.reject(err);
    });

    return defer.promise;
  };

  /**
   * sends file to be written on server
   * @param  {obj} document - file obj
   * @return {bool or err} data - true or err obj
   */
  this.writeFile = function (document) {
  	var defer = $q.defer();
  	$http.post(URL_WRITE_FILE, document).success(function (data) {
      defer.resolve(data);
    }).error(function (data, status, headers, config) {
      defer.reject(data);
      console.log('error status: ' + status);
      console.log('error data: ' + data);
    });
    return defer.promise;
  }
  /**
   * converts file to pdf
   * @param  {obj} document - file obj
   * @return {bool or err} data - true or err obj
   */
  this.convertToPdf = function (document) {
  	var defer = $q.defer();
  	$http.post(URL_CONVERT_TO_PDF, document).success(function (data) {
      defer.resolve(data);
    }).error(function (data, status, headers, config) {
      defer.reject(data);
      console.log('error status: ' + status);
      console.log('error data: ' + data);
    });
    return defer.promise;
  }
  /**
   * merges pdf's on server
   * @param  {documents} documents - documents to be merged
   * @return {bool or err} data - true or err obj
   */
  this.mergePdf = function (documents) {
  	var defer = $q.defer();
  	$http.post(URL_MERGE_PDF, documents).success(function (data) {
      defer.resolve(data);
    }).error(function (data, status, headers, config) {
      defer.reject(data);
      console.log('error status: ' + status);
      console.log('error data: ' + data);
    });
    return defer.promise;
  }
  /**
   * requests file to be written on AWS then saves it to MongoDB
   * @param  {obj} document - used to name record in AWS
   * @return {bool or err} data - true or err obj
   */
  this.writeToAws = function (document) {
  	var defer = $q.defer();
  	$http.post(URL_WRITE_AWS, document).success(function (data) {
      var temp_doc = {
      	title: document.renamed,
				documentUrl: data.documentUrl,
				recordId: document.recordId,
				date: new Date(),
				type: 'application/pdf'
      }
      var new_doc = new documentFctr(document.recordId, '', temp_doc);
      self.postDocumentRecord(new_doc, function (document) {
        defer.resolve(document);
      }, function (err) {
        defer.reject(err);
      });
    }).error(function (data, status, headers, config) {
      defer.reject(data);
      console.log('error status: ' + status);
      console.log('error data: ' + data);
    });
    return defer.promise;
  }
  /**
   * deletes any pdf's in users file on server
   * @param  {obj} recordId
   * @return {bool}
   */
  this.deletePdfs = function (recordId) {
  	var defer = $q.defer();
  	$http.post(URL_DELETE_PDF, recordId)
  	.success(function (data) {
      defer.resolve(data);
	  }).error(function (data, status, headers, config) {
      defer.reject(data);
      console.log('error status: ' + status);
      console.log('error data: ' + data);
    });
    return defer.promise;
  }

  /* download documents service */
  // OUTDATED!! USING xmlHttpDocuments INSTEAD
  this.downloadDocuments = function (document) {
    var defer = $q.defer();
    if (document.documentUrl) {
      $http.get(URL_S3 + document.documentUrl).success(function (data) {
        defer.resolve(data);
        console.log('Downloaded document');
      }).error(function (err) {
        defer.reject(err);
      });
      return defer.promise;
    }
  };
  /**
   * get document from AWS
   * @param  {obj} document - mongo obj of document
   * @return {blob} xhr.response - blob of file from AWS
   */
  this.xmlHttpDocuments = function (document) {
  	var defer = $q.defer();
  	var xhr   = new XMLHttpRequest();

		xhr.open("GET", URL_S3 + document.documentUrl, true);
		xhr.responseType = 'blob';
		xhr.onload = function(e){
			defer.resolve(xhr.response)
			console.log('Downloaded document');
		}
		xhr.onerror = function(err){
			defer.reject(err)
			console.log('Error: ', err);
		}
		xhr.send();
		return defer.promise;
  }

});




