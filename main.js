const Client = require('ftp');
const fs = require('fs');
const path = require('path');

const compress_images = require('compress-images');
const imagemin = require('imagemin');
const imageminJpegtran = require('imagemin-jpegtran');
const imageminPngquant = require('imagemin-pngquant');
const imageminWebp = require('imagemin-webp');
const imageminMozjpeg = require('imagemin-mozjpeg');

const config = require('config');
const fsConfig = config.get('fs_config');
const bckup_loc = config.get('bckup_loc');
const env = config.get('env');

const filesize = require('filesize');

const fetch = require('node-fetch');

const https = require('https');

const EventEmitter = require('events');
let customEvent = new EventEmitter();

const siteUrl = "https://ds-iot.000webhostapp.com";
const pageSpeedUrl = ("https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=" + siteUrl);

fetch(pageSpeedUrl)
  .then(response => response.json())
  .then(json => {
    auditReport(json);
  })
  .catch(err => cmdDevLogger(`error, unable to fetch data: ${err}`, 0));

function auditReport(json) {
  cmdDevLogger(`fetch to ${pageSpeedUrl} completed!`, 1);
  cmdDevLogger('here is the nexgen image urls:', 1);
  let imgLinks = json.lighthouseResult.audits["uses-webp-images"].details.items
    .map(item => item.url)
    .filter(url => url.match(/https:\/\/ds-iot.000webhostapp.com/));
  cmdDevLogger(`links (${imgLinks.length}): ${imgLinks}`, 1);

  processArray(imgLinks)
    .catch(err => cmdDevLogger(`something went wrong!: ${err}`, 0));

  let c = new Client();

  connectToFTP(c, fsConfig);
}

async function processArray(array) {
  for (const item of array) {
    await downloadImage(item, bckup_loc);
  }
  cmdDevLogger('async process of array succesfully completed!', 1);

}

function downloadImage(url, localPath) {
  var fullUrl = url;
  var fileName = `/${path.basename(fullUrl)}`;
  try {
    https.get(fullUrl, function (response) {
      let backupPath = useOrCreateFolder(localPath);
      response.pipe(createOrOverwriteFile(`${backupPath + fileName}`))
        .on('finish', function () {
          let fStat = fs.statSync(`${backupPath + fileName}`);
          let fileSizeInBytes = fStat.size;
          cmdDevLogger(`file size: ${backupPath + fileName} - ${filesize(fileSizeInBytes, { round: 0 })}`, 1);
          compressionMod1(`${backupPath + fileName}`, `compressed/`);
        });
    });
    cmdDevLogger(`file ${path.basename(fullUrl)} retrieved from remote server`, 1);
  } catch (err) {
    cmdDevLogger(`error downloading image ${url} : ${err}`, 0);
  }
}

// Connect to remote server

function uploadToServer(src, dest) {

}

/**
 * 
 * @param {Client} client 
 * @param {JSON} config 
 */
function connectToFTP(client, config) {

  client.on('ready', function () {

    //client.put();

    cmdDevLogger('connect success! closing connection now', 1);
    client.end();
  });

  client.on('error', function (err) {
    cmdDevLogger(err, 0);
    client.end();
  });

  client.connect(fsConfig);

  //uploadToServer();
}

/**
 * 
 * @description driver function 
 */
function fetchRemoteFiles(url) {
  let imageName = path.basename(url);

  c.get(url, function (err, stream) {
    if (err) throw err;

    let backupPath = useOrCreateFolder(bckup_loc);

    let fileName = `/${imageName}`;
    stream.pipe(createOrOverwriteFile(`${backupPath + fileName}`))
      .on('finish', function () {
        let fStat = fs.statSync(`${backupPath + fileName}`);
        let fileSizeInBytes = fStat.size;
        cmdDevLogger(`file size: ${backupPath + fileName} - ${filesize(fileSizeInBytes, { round: 0 })}`, 1);
        compressionMod1(`${backupPath + fileName}`, `compressed/`);
      })
      .on('close', function () {
        cmdDevLogger('closed client socket', 1);
        c.end();
      });
  });
  cmdDevLogger("file retrieved from remote server", 1);
}



/**
 * 
 * @description driver function 
 */
function backupFiles(err, stream) {
  if (err) throw err;

  let backupPath = useOrCreateFolder(bckup_loc);

  let fileName = `/${imageName}`;
  stream.pipe(createOrOverwriteFile(`${backupPath + fileName}`))
    .on('finish', function () {
      let fStat = fs.statSync(`${backupPath + fileName}`);
      let fileSizeInBytes = fStat.size;
      cmdDevLogger(`file size: ${backupPath + fileName} - ${filesize(fileSizeInBytes, { round: 0 })}`, 1);
      compressionMod1(`${backupPath + fileName}`, `compressed/`);
    })
    .on('close', function () {
      cmdDevLogger('closed client socket', 1);
      c.end();
    });
}

function createOrOverwriteFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      cmdDevLogger(`${filePath} file created`, 1);
      return fs.createWriteStream(filePath);
    } else {
      fs.unlinkSync(filePath);
      cmdDevLogger(`${filePath} file removed`, 1);
      cmdDevLogger(`${filePath} file created`, 1);
      return fs.createWriteStream(filePath);
    }
  } catch (err) {
    cmdDevLogger(err, 0);
  }
}

/**
 * 
 * @param {string} fName a folder name
 * @return {string}
 * @description create a folder or use existing if exist
 * 
 */
function useOrCreateFolder(folderName) {
  try {
    if (!fs.existsSync(folderName)) {
      fs.mkdirSync(folderName);
      cmdDevLogger(`${folderName} folder created`, 1);
      return folderName;
    } else {
      cmdDevLogger(`${folderName} folder already exists`, 1);
      return folderName;
    }
  } catch (err) {
    cmdDevLogger(err, 0);
  }
}

/**
 * 
 * @param {string} src path to source file
 * @param {string} out path to output file
 * @description compression pacjage 2 - compress-images https://www.npmjs.com/package/compress-images
 */
function compressionMod2(src, out) {
  compress_images(`${src}`, `${out}`, {
    compress_force: false,
    statistic: true,
    autoupdate: true
  }, false, {
    jpg: {
      engine: 'mozjpeg',
      command: ['-quality', '60']
    }
  }, {
    png: {
      engine: 'pngquant',
      command: ['--quality=20-50']
    }
  }, {
    svg: {
      engine: 'svgo',
      command: '--multipass'
    }
  }, {
    gif: {
      engine: 'gifsicle',
      command: ['--colors', '64', '--use-col=web']
    }
  }, function (err, completed) {
    if (completed === true) {

      let fStat = fs.statSync(`${out + path.basename(src)}`);
      let fileSizeInBytes = fStat.size;
      cmdDevLogger(`Image(s) optimized: ${out + path.basename(src)} - ${filesize(fileSizeInBytes, { round: 0 })}`);
    } else {
      cmdDevLogger(err, 0);
    }
  });
}



/**
 * 
 * @param {string} src path to source file
 * @param {string} out path to output file
 * @description compression package 1 - imagemin - https://www.npmjs.com/package/imagemin
 */
async function compressionMod1(src, out) {
  cmdDevLogger("compresing image...", 1);

  await imagemin([src], out, {
    use: [
      imageminMozjpeg({
        quality: 40
      }),
      imageminPngquant({
        quality: [0.65, 0.80]
      })
    ]
  }).then(() => {
    let fStat = fs.statSync(`${out + path.basename(src)}`);
    let fileSizeInBytes = fStat.size;

    cmdDevLogger(`Image optimized: ${out + path.basename(src)} - ${filesize(fileSizeInBytes, { round: 0 })}`, 1);
  }).catch(err => {
    cmdDevLogger(err, 0);
  });
}

/**
 * 
 * @param {string} msg the message to be logged
 * @param {Int16Array} type the message type 0 - error , 1 - success
 * @description will on log if env variable is set to development
 */
function cmdDevLogger(msg, type) {
  if (env === "development") {
    // codes : 1 - success, 0 - generic error
    let codes = {
      "codes": {
        "0": "generic error",
        "1": "success"
      }
    };

    switch (type) {
      case 0:
        console.error("Error: ", msg);
        break;
      case 1:
        console.log("Msg: ", msg);
        break;
      default:
        console.log("invalid msg log type passed: ", type);
        console.log("available codes: ", JSON.stringify(codes));
    }
  } else {
    // production
  }
}