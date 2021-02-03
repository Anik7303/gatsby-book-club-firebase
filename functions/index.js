const functions = require('firebase-functions');

const admin = require('firebase-admin');
admin.initializeApp();

exports.postComment = functions.https.onCall((data, context) => {
    checkAuthentication(context);
    dataValidator(data, {
        bookId: 'string',
        comment: 'string',
    });

    const { comment, bookId } = data;
    const db = admin.firestore();
    const bookRef = db.collection('books').doc(bookId);

    return db
        .collection('profiles')
        .where('userId', '==', context.auth.uid)
        .limit(1)
        .get()
        .then((snapshot) =>
            db.collection('comments').add({
                content: comment,
                user: snapshot.docs[0].id,
                book: bookRef,
                created: new Date(),
            })
        );
});

function checkAuthentication(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'You must be signed in to use this feature'
        );
    }
}

function dataValidator(data, validKeys) {
    if (Object.keys(data).length !== Object.keys(validKeys)) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Data object contains invalid number of properties'
        );
    }
    for (let key in data) {
        if (!validKeys[key] || typeof data[key] !== validKeys[key]) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Data object contains invalid properties'
            );
        }
    }
}
