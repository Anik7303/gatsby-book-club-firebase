const functions = require('firebase-functions');
const mimeTypes = require('mime-types');

const admin = require('firebase-admin');
admin.initializeApp();
const DB = admin.firestore();
const AUTH = admin.auth();
const STORAGE = admin.storage();

exports.createProfile = functions.https.onCall(async (data, context) => {
    checkAuthentication(context);
    dataValidator(data, { username: 'string' });

    const { username } = data;

    const userProfile = await DB.collection('profiles')
        .where('userId', '==', context.auth.uid)
        .limit(1)
        .get();
    if (!userProfile.empty) {
        throw new functions.https.HttpsError(
            'already-exists',
            'This user already has a public profile'
        );
    }

    const profile = await DB.collection('profiles').doc(username).get();
    if (profile.exists) {
        throw new functions.https.HttpsError(
            'already-exists',
            'This username already belongs to an existing user'
        );
    }

    const user = await AUTH.getUser(context.auth.uid);
    if (user.email === functions.config().accounts.admin) {
        await AUTH.setCustomUserClaims(context.auth.uid, { admin: true });
    }

    return DB.collection('profiles')
        .doc(username)
        .set({ userId: context.auth.uid });
});

exports.postComment = functions.https.onCall((data, context) => {
    checkAuthentication(context);
    dataValidator(data, {
        bookId: 'string',
        comment: 'string',
    });

    const { comment, bookId } = data;
    const bookRef = DB.collection('books').doc(bookId);

    return DB.collection('profiles')
        .where('userId', '==', context.auth.uid)
        .limit(1)
        .get()
        .then((snapshot) =>
            DB.collection('comments').add({
                content: comment,
                user: snapshot.docs[0].id,
                book: bookRef,
                created: new Date(),
            })
        );
});

exports.addAuthor = functions.https.onCall(async (data, context) => {
    checkAuthentication(context, true);
    dataValidator(data, { name: 'string' });

    const exists = await DB.collection('authors')
        .where('name', '==', data.name)
        .get();
    if (!exists.empty) {
        throw new functions.https.HttpsError(
            'already-exists',
            'This author already exists'
        );
    }

    return DB.collection('authors').add({ name: data.name });
});

exports.createBook = functions.https.onCall(async (data, context) => {
    checkAuthentication(context, true);
    dataValidator(data, {
        title: 'string',
        summary: 'string',
        authorId: 'string',
        bookCover: 'string',
    });

    const { title, summary, bookCover, authorId } = data;

    const mimeType = bookCover.match(
        /data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/
    )[1];
    const base64EncodedImageString = bookCover.replace(
        /^data:image\/\w+;base64,/,
        ''
    );
    const imageBuffer = new Buffer.from(base64EncodedImageString, 'base64');

    const filename = `bookCovers/${title}.${mimeTypes.detectExtension(
        mimeType
    )}`;
    const file = STORAGE.bucket().file(filename);
    await file.save(imageBuffer, { contentType: 'image/jpeg' });
    const fileUrls = await file.getSignedUrl({
        action: 'read',
        expires: '03-09-2491',
    });

    const authorRef = DB.collection('authors').doc(authorId);
    return DB.collection('books').add({
        title,
        summary,
        imageUrl: fileUrls[0],
        author: authorRef,
    });
});

function checkAuthentication(context, admin = false) {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'You must be signed in to use this feature'
        );
    }

    if (admin && !context.auth.token.admin) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'You must be an admin to use this feature'
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
