const swaggerUI = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const {
    name,
    version,
    description,
    bugs,
    license,
    repository
} = require('./package.json');

const repository_url = repository.url.substring(
    repository.url.indexOf('+') + 1,
    repository.url.indexOf('.git')
);

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: `${name} API`,
            version: version,
            description: description,
            contact: {
                name: `${name} API Support`,
                url: bugs.url
            },
            license: {
                name: license,
                url: `${repository_url}/blob/master/LICENSE.txt`
            }
        },
        basePath: '/'
    },
    apis: ['./index.js']
};

const specs = swaggerJSDoc(options);

module.exports = app => {
    app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(specs));
};
