var shell    = require('shelljs');

/**
 * merges all pdfs in appropriate folder
 * @param  {obj} req  - req obj from client. data is in req.body
 * @param  {obj} res 	- response obj to send data back to client
 * @return {bool}     - true if successfully merged
 */
exports.mergePdf = function (req, res) {
	var temp_path  = '/pdf/' + req.body[0].recordId + '/';
	var temp_in 	 = '';
	var temp_out   = '/pdf/' + req.body[0].recordId + '/' + req.body[0].renamed;
	var temp_title = [];

	for (var i = 0; i < req.body.length; i++) {
		temp_title[i] = req.body[i].title.replace(/\s+/g, '');
		temp_title[i] = temp_title[i].replace(/[!$%^&*()+|~=`{}\[\]:";'<>?,\/]/g, '-');
		temp_title[i] = temp_title[i].slice(0, temp_title[i].lastIndexOf('.'));
		temp_title[i] = temp_title[i] + '.pdf';
		temp_in += temp_path + temp_title[i] + ' ';
	}

	shell.exec('pdftk ' + temp_in + 'cat output ' + temp_out, function (err, data) {
		if (err) {
			res.status(400).send('mergdPdf - ' + err);	
		}else {
			for (var i = 0; i < req.body.length; i++) {
				var temp_title = req.body[i].title.replace(/\s+/g, '');
				temp_title 		 = temp_title.replace(/[!$%^&*()+|~=`{}\[\]:";'<>?,\/]/g, '-');
				temp_title = temp_title.slice(0, temp_title.lastIndexOf('.'));
				temp_title = temp_title + '.pdf';
				shell.rm('-f', temp_path + temp_title);
			}
			res.sendStatus(200);
		}
	});
};




