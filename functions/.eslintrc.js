module.exports = {
    root: true,
    env: {
        es6: true,
        node: true,
    },
    extends: ['eslint:recommended', 'google'],
    rules: {
        quotes: ['error', 'single'],
        indent: ['error', 4],
        objectCurlySpacing: false,
        requireJSDoc: false,
    },
};
