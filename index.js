const express = require('express');
const sharp = require('sharp');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const app = express();
const swagger = require('./swagger');
const PORT = 8080;

// Setup uploads folder
const UPLOADS_FOLDER = 'uploads';
if (!fs.existsSync(UPLOADS_FOLDER)) {
    fs.mkdirSync(UPLOADS_FOLDER, (err, folder) => {
        if (err) {
            console.error(err);
            return;
        }
        console.info('Uploads folder created: ', folder);
    });
}

app.param('image', (req, res, next, image) => {
    if (!image.match(/\.(png|jpg)$/i)) {
        return res.status(req.method == 'POST' ? 403 : 404).end();
    }

    req.image = image;
    req.localPath = path.join(__dirname, UPLOADS_FOLDER, req.image);

    return next();
});

app.param('width', (req, res, next, width) => {
    req.width = +width;

    if (isNaN(req.width)) {
        return next(new Exception('Image size must be in pixels'));
    }
    return next();
});

app.param('height', (req, res, next, height) => {
    req.height = +height;

    if (isNaN(req.height)) {
        return next(new Exception('Image size must be in pixels'));
    }
    return next();
});

app.post('/uploads/:image', bodyParser.raw({
    limit: '10mb',
    type: 'image/*'
}), (req, res) => {
    let fd = fs.createWriteStream(req.localPath, {
        flags: 'w+',
        encoding: 'binary'
    });

    fd.write(req.body);
    fd.end();

    fd.on('close', () => res.send({ status: 'ok', size: req.body.length }));
    fd.on('error', err => res.status(500).send({ status: 'error', message: err }));
});

app.head('/uploads/:image', (req, res) => {
    fs.access(
        req.localPath,
        fs.constants.R_OK,
        (err) => {
            res.status(err ? 404 : 200);
            res.end();
        }
    );
});

app.get('/uploads/:image', (req, res) => {
    let fd = fs.createReadStream(req.localPath);

    fd.on('error', err => res.status(err.code == "ENOENT" ? 404 : 500).end());
    res.setHeader('Content-Type', 'image/' + path.extname(req.image).substr(1));

    fd.pipe(res);
});

/**
 * @swagger
 *
 * /thumbnail.png:
 *   get:
 *     description: Get static thumbnail with customizable properties. Supported image formats are `PNG` and `JPG`, so, endpoint could be as follows `/thumbnail.{png|jpg}`.
 *     produces:
 *       - image/png
 *       - image/jpeg
 *     parameters:
 *      - name: width
 *        in: query
 *        description: thumbnail width in pixels.
 *        required: false
 *        style: form
 *        schema:
 *          type: integer
 *          format: int32
 *          default: 300
 *      - name: height
 *        in: query
 *        description: thumbnail height in pixels.
 *        required: false
 *        style: form
 *        schema:
 *          type: integer
 *          format: int32
 *          default: 200
 *      - name: border
 *        in: query
 *        description: thumbnail border in pixels.
 *        required: false
 *        style: form
 *        schema:
 *          type: integer
 *          format: int32
 *          default: 5
 *      - name: bgcolor
 *        in: query
 *        description: background color in hex format.
 *        required: false
 *        style: form
 *        schema:
 *          type: string
 *          default: '#FCFCFC'
 *      - name: fgcolor
 *        in: query
 *        description: foreground color in hex format.
 *        required: false
 *        style: form
 *        schema:
 *          type: string
 *          default: '#DDD'
 *      - name: textcolor
 *        in: query
 *        description: thumbnail text color.
 *        required: false
 *        style: form
 *        schema:
 *          type: string
 *          default: '#AAA'
 *      - name: textsize
 *        in: query
 *        description: thumbnail font size.
 *        required: false
 *        style: form
 *        schema:
 *          type: integer
 *          format: int32
 *          default: 24
 *     responses:
 *       200:
 *         description: PNG/JPG thumbnail image.
 */
app.get(/\/thumbnail\.(jpg|png)/, (req, res, next) => {
    let format = req.params[0] == 'png' ? 'png' : 'jpeg';
    let width = +req.query.width || 300;
    let height = +req.query.height || 200;
    let border = +req.query.border || 5;
    let bgcolor = req.query.bgcolor || '#fcfcfc';
    let fgcolor = req.query.fgcolor || '#ddd';
    let textcolor = req.query.textcolor || '#aaa';
    let textsize = +req.query.textsize || 24;
    let image = sharp({
        create: {
            width: width,
            height: height,
            channels: 4,
            background: { r: 0, g: 0, b: 0 }
        }
    });

    const thumbnail = Buffer.from(
        `<svg width='${width}' height='${height}'>
            <rect
                x='0' y='0'
                width='${width}' height='${height}'
                fill='${fgcolor}' />
            <rect
                x='${border}' y='${border}'
                width='${width - border * 2}' height='${height - border * 2}'
                fill='${bgcolor}' />
            <line
                x1='${border * 2}' y1='${border * 2}'
                x2='${width - border * 2}' y2='${height - border * 2}'
                stroke-width='${border}' stroke='${fgcolor}' />
            <line
                x1='${width - border * 2}' y1='${border * 2}'
                x2='${border * 2}' y2='${height - border * 2}'
                stroke-width='${border}' stroke='${fgcolor}' />
            <rect
                x='${border}' y='${(height - textsize) / 2}'
                width='${width - border * 2}' height='${textsize}'
                fill='${bgcolor}' />
            <text
                x='${width / 2}' y='${height / 2}' dy='8'
                font-family='Helvetica' font-size='${textsize}'
                fill='${textcolor}' text-anchor='middle'>${width} x ${height}</text>
        </svg>`
    );

    res.setHeader('Content-Type', 'image/' + format);
    image
        .composite([{ input: thumbnail }])
    [format]()
        .pipe(res);
});

swagger(app);

app.listen(PORT, () => {
    console.log(`server listening at http://localhost:${PORT}`);
});
