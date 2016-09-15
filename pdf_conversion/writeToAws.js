var AWS          = require('aws-sdk');
var config       = require('../aws/aws.json');
var fs           = require('fs');

function guid () {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

exports.writeToAws = function (req, res) {
	var s3 					= new AWS.S3(config);
	var temp_title  = req.body.renamed.replace(/\s+/g, '');
	temp_title 		  = temp_title.replace(/[!$%^&*()+|~=`{}\[\]:";'<>?,\/]/g, '-');
	var temp_path   = '/pdf/' + req.body.recordId + '/';
	var documentUrl = "documents/" + req.body.recordId + "-" + guid() + temp_title;

	var body = fs.createReadStream(temp_path + temp_title);
	s3.upload({
		Bucket: config.bucket,
		Key: documentUrl,
		ACL: 'public-read',
		Body: body
	}, function (err, data) {
		if (err) {
			body.close();
			res.status(400).send('writeToAws, ', err);
		}else {
			console.log('success: ', data);
			body.close();
			res.status(200).send({success: true, documentUrl: documentUrl});
		}
	}).
	on('httpUploadProgress', function(evt) {
		// console.log('progress: ', evt);
	}).
	on('error', function (err) {
		body.close();
		res.status(400).send('writeToAws, ', err);
	})
}




