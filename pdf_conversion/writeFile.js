var request  = require('request');
var fs       = require('fs');
var shell 	 = require('shelljs');

exports.writeToServer = function (req, res) {
	var temp_title  = req.body.title.replace(/\s+/g, '');
	temp_title 			= temp_title.replace(/[!$%^&*()+|~=`{}\[\]:";'<>?,\/]/g, '-');
	var temp_path   = '/pdf/' + req.body.recordId + '/';
	var stream      = request('https://s3.amazonaws.com/example/' + req.body.documentUrl);
	var options = {
	  defaultEncoding: 'utf8',
	}
	var writeStream = fs.createWriteStream(temp_path + temp_title, options);

	stream.on('data', function (data) {
		writeStream.write(data);
	}).
	on('error', function (err) {
		writeStream.close();
		res.status(400).send('writeFile, ' + err);
	}).
	on('end', function () {
		writeStream.end();
		console.log('Finished Writing');
		res.status(200).send(true);
	});
}




