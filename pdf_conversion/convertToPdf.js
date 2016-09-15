var shell = require('shelljs');

/**
 * converts documents in appropriate tmp folder to pdf documents using...
 * ...Libre Offices "soffice --headless --convert-to" command.
 * This file is ignored by git, if making edits please...
 * ...manually upload to server.
 * DO NOT remove from .gitignore
 * @param  {obj} req obj w/request from client. data is in req.body
 * @param  {obj} res response obj to send data back to client
 * @return {bool}     true if successfully converted, false if unsuccessful
 */
exports.convertToPdf = function (req, res) {
	var temp_title = req.body.title.replace(/\s+/g, '');
	var temp_path  = '/pdf/' + req.body.recordId + '/';
	// replaces characters that will break the conversion with a dash '-'
	temp_title 		 = temp_title.replace(/[!$%^&*()+|~=`{}\[\]:";'<>?,\/]/g, '-');
	// do not convert if doc is already a pdf
	if (req.body.type != 'application/pdf') {
		// USE THIS ONE ON LIVE SERVER
		// shell.exec('soffice --headless --convert-to pdf ' + temp_path + temp_title + ' --outdir ' + temp_path, function (err, stdout, code) {
		// 	if (err) {
		// 		res.status(400).send('convertToPdf - ' + err + ' - ' + code);
		// 	}else {
		// 		console.log('Finished Converting')
		// 		shell.rm('-f', temp_path + temp_title);
		// 		res.status(200).send(true);
		// 	}
		// })
		

		//for testing on local machine(symlink to soffice isn't working on my local machine but does on prod server)
		shell.exec('/Applications/LibreOffice.app/Contents/MacOS/soffice --headless --convert-to pdf ' + temp_path + temp_title + ' --outdir ' + temp_path, function (err, stdout, code) {
			console.log(err, stdout, code);
			if (err) {
				res.status(400).send('convertToPdf - ' + err);
			}else {
				console.log('Finished Converting')
				shell.rm('-f', temp_path + temp_title);
				res.status(200).send(true);
			}
		})
	}else {
		res.status(200).send(true);
	}
}




