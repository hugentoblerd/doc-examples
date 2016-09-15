var shell = require('shelljs');
/**
 * deletes all PDFs from appropriate pdf folder
 * @param  {obj} req - request obj from client. data is in req.body
 * @param  {obj} res - response obj to send data back to client
 * @return {bool}    - true if successfully deleted
 */
exports.deletePdfs = function (req, res) {
	var temp_path  = '/pdf/' + req.body.recordId + '/';
	// removes all files in appropriate directory
	if (shell.rm('-f', temp_path + '*')) {
		// makes sure that appriate directory is created
		if (shell.mkdir('-p', temp_path)) {
			res.status(200).send(true);
		}
		res.status(200).send('files removed but no folder created');
	}
	res.status(200).send('files not removed and no folder created');
}




