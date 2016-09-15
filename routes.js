var router              = require('express').Router();
var Document            = require('./model').Document;
var aws                 = require('./aws/aws');
var mandrillhandler     = require('./mandrill').mandrill;
var writeFilehandler    = require('./pdf_conversion/writeFile').writeToServer;
var convertToPdfhandler = require('./pdf_conversion/convertToPdf').convertToPdf;
var mergePdfhandler 		= require('./pdf_conversion/mergePdf').mergePdf;
var writeToAwshandler 	= require('./pdf_conversion/writeToAws').writeToAws;
var deletePdfshandler 	= require('./pdf_conversion/deletePdfs').deletePdfs;

/******************************************************************
 * This route renders the main HTML page and passes in the recordId via EJS templating so Angular can make API requests to Amazon with that key
 *******************************************************************/
router.get('/documentmanager/:recordId', function (req, res) {
  res.render('index.html', {
    recordId: req.params.recordId
  });
});

router.get('/documentmanager/:recordId/:renamed', function(req, res){
	recordId = req.params.recordId,
	renamed	 = req.params.renamed,
  require('fs').readFile('/pdf/' + recordId + '/' + renamed, function(err, data){
    res.send(data);
  })
});

router.post('/api/document/:recordId/:status', function (req, res) {
  Document.find({
    status: req.params.status,
    recordId: req.params.recordId
  }, function (err, documents) {
    if (err)
      res.status(400).send({
        msg: 'Problem retrieving documents'
      });

    res.status(200).send(documents);
  });
});

router.post('/api/document/:recordId', function (req, res) {
  Document.find({
    recordId: req.params.recordId
  }, function (err, documents) {  	
    if (err)
      res.status(400).send({
        msg: 'Problem retrieving documents',
      });

    res.status(200).send(documents);
  });
});

router.post('/api/document', function (req, res) {

  if (!req.body)
    res.status(400).send({
      msg: 'Request must have a body'
    });

  delete req.body.tags;
  var document = new Document(req.body);
  document.save(function (err, newDocument) {

    if (err) {
      res.status(400).send({
        msg: "Could not save document",
        err: err
      });
    }

    res.status(200).send(newDocument);
  });
});

router.put('/api/document/:documentId', function (req, res) {

  if (!req.body) {
    res.status(400).send({msg:"Request must have a body"});
  }

  delete req.body._id;
  delete req.body.__v;

  Document.findOneAndUpdate({
    _id: req.params.documentId
  }, req.body, {
    upsert: true,
    new: true
  }, function (err, updatedDocument) {

    if (err) {
      console.log(err);
      res.status(400).send({msg:"Could not update document", err:err});
    }

    res.status(200).send(updatedDocument);
  });
});

router.get('/count-documents/:recordId', function (req, res) {
	Document.count({
    recordId: req.params.recordId
  }, function (err, count) {
    if (err)
      res.status(400).send({
        msg: 'Problem retrieving number of documents'
      });

    res.status(200).send(String(count));
  });
});

router.post('/api/sendemail', mandrillhandler);

router.post('/api/writefile', writeFilehandler);

router.post('/api/converttopdf', convertToPdfhandler);

router.post('/api/mergepdf', mergePdfhandler);

router.post('/api/writetoaws', writeToAwshandler);

router.post('/api/deletepdfs', deletePdfshandler);

router.delete('/api/document/:documentId', function(req, res) {
  Document.findOneAndRemove({_id: req.params.documentId}, function(err) {
    if (err) {
      res.status(400).send({msg: "Could not delete document"});
    }
    res.status(200).send({msg:"Successfully deleted document"});
  });
});

router.get('/api/migrate', function(req, res) {
  Document.find({status:{'$ne':null}}, function(err, data) {

    for (var x = 0; x < data.length; x++) {

      var document = data[x];

      if (document.tags == null) {
        documents.tags = [];
      }

      document.tags.push(document.status);
      document.save();

    }

    res.status(200).send(data);

  });
})

router.get('/api/s3Policy', aws.getS3Policy);

module.exports = router;




