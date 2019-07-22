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
        return res.status(req.method == 'POST' ? 403 : 404).send({ status: 'error', message: 'Unsupported image format' });
    }

    req.image = image;
    req.localPath = path.join(__dirname, UPLOADS_FOLDER, req.image);

    return next();
});

const download_image = (req, res) => {
    fs.exists(req.localPath, exists => {

        if (!exists) {
            return res.status(404).send({ status: 'error', message: 'Image has not been uploaded yet' });
        }
        fs.access(req.localPath, fs.constants.R_OK, err => {
            if (err) {
                return res.status(404).end({ status: 'error', message: err });
            }

            let image = sharp(req.localPath);
            let width = +req.query.width;
            let height = +req.query.height;
            let blur = +req.query.blur;
            let sharpen = +req.query.sharpen;
            let greyscale = req.query.greyscale == 'true';
            let flip = req.query.flip == 'true';
            let flop = req.query.flop == 'true';
            let options = {};

            if (width && height) {
                options = { canvas: 'ignoreAspectRatio' }
            }

            if (width || height) {
                image.resize(width || null, height || null, options);
            }

            if (blur) image.blur(blur);
            if (sharpen) image.sharpen(sharpen);
            if (greyscale) image.greyscale();
            if (flip) image.flip();
            if (flop) image.flop();

            res.setHeader('Content-Type', `image/${path.extname(req.image).substr(1)}`)
            image.pipe(res);
        });
    })
};

/**
 * @swagger
 *
 * /uploads/{image}:
 *   get:
 *     description: Get image with customizable properties. Supported image formats are `PNG` and `JPG`, so, endpoint could be as follows `/your_image.{png|jpg}`.
 *     produces:
 *       - image/png
 *       - image/jpeg
 *     parameters:
 *      - name: image
 *        in: path
 *        description: file name (including extension).
 *        required: true
 *        schema:
 *          type: string
 *      - name: width
 *        in: query
 *        description: in pixels.
 *        required: false
 *        style: form
 *        schema:
 *          type: integer
 *          format: int32
 *      - name: height
 *        in: query
 *        description: in pixels.
 *        required: false
 *        style: form
 *        schema:
 *          type: integer
 *          format: int32
 *      - name: blur
 *        in: query
 *        description: apply blur effect to the image.
 *        required: false
 *        style: form
 *        schema:
 *          type: integer
 *          format: int32
 *      - name: sharpen
 *        in: query
 *        description: apply sharpen effect to the image.
 *        required: false
 *        style: form
 *        schema:
 *          type: integer
 *          format: int32
 *      - name: flip
 *        in: query
 *        description: flip the image vertically.
 *        required: false
 *        style: form
 *        schema:
 *          type: boolean
 *      - name: flop
 *        in: query
 *        description: flip the image horizontally.
 *        required: false
 *        style: form
 *        schema:
 *          type: boolean
 *      - name: greyscale
 *        in: query
 *        description: apply to image grey scale colors only.
 *        required: false
 *        style: form
 *        schema:
 *          type: boolean
 *     responses:
 *       200:
 *         description: PNG/JPG image.
 *       404:
 *         description: Image has not been uploaded and is not available.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Request status.
 *                 message:
 *                   type: object | string
 *                   description: error message.
 *               example:
 *                 status: 'error'
 *                 message: 'Image has not been uploaded yet'
 */
app.get('/uploads/:image', download_image);

/**
 * @swagger
 *
 * /uploads/{image}:
 *   post:
 *     description: Upload/Re-upload an image.
 *     produces:
 *       - application/json
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *      - name: image
 *        in: path
 *        description: image file name (including extension).
 *        required: true
 *        schema:
 *          type: string
 *      - in: body
 *        description: the image data to upload.
 *        required: true
 *        schema:
 *          type: file
 *     responses:
 *       200:
 *         description: Image has been uploaded and available.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Request status.
 *                 size:
 *                   type: integer
 *                   format: int32
 *                   description: Image size.
 *               example:
 *                 status: 'ok'
 *                 message: 8287
 *       403:
 *         description: Internal error while uploading image.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Request status.
 *                 message:
 *                   type: object
 *                   format: int32
 *                   description: Image size.
 *               example:
 *                 status: 'error'
 *                 message: { exception: '..', path: '..'}
 *       500:
 *         description: Internal error while uploading image.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Request status.
 *                 message:
 *                   type: object
 *                   format: int32
 *                   description: Image size.
 *               example:
 *                 status: 'error'
 *                 message: { exception: '..', path: '..'}
 */
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

/**
 * @swagger
 *
 * /uploads/{image}:
 *   head:
 *     description: Verify image has been uploaded and exists.
 *     produces:
 *       - application/json
 *     parameters:
 *      - name: image
 *        in: path
 *        description: target image to verify if already exists.
 *        required: true
 *        schema:
 *          type: string
 *     responses:
 *       200:
 *         description: Image has been uploaded and available.
 *       404:
 *         description: Image has not been uploaded and is not available.
 */
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
