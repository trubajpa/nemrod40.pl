import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { commentConverter } from './converters';
import type { DeviceComment } from './models';
import { logDeviceError, safeSnapshot } from './repositoryUtils';
import { buildCommentPayload } from './operationPlans';
export type CommentInput = Pick<DeviceComment, 'type' | 'content' | 'relatedType' | 'relatedId'>;
export function subscribeComments(deviceId: string, onData: (x: DeviceComment[]) => void, onError: () => void) { return onSnapshot(query(collection(db, 'devices', deviceId, 'comments'), orderBy('createdAt', 'desc')), s => onData(safeSnapshot(s, commentConverter)), e => { logDeviceError('list_comments', e); onError(); }); }
export function createComment(deviceId: string, input: CommentInput, author: {
    uid: string;
    name: string;
}) { return addDoc(collection(db, 'devices', deviceId, 'comments'), { ...buildCommentPayload(input, author), createdAt: serverTimestamp() }); }
export function moderateComment(deviceId: string, commentId: string, status: DeviceComment['status'], uid: string) { return updateDoc(doc(db, 'devices', deviceId, 'comments', commentId), { status, moderatedAt: serverTimestamp(), moderatedBy: uid }); }
export async function editComment(deviceId: string, commentId: string, content: string, uid: string) {
    if (!content.trim())
        throw new Error('Treść komentarza jest wymagana.');
    const ref = doc(db, 'devices', deviceId, 'comments', commentId), history = doc(collection(ref, 'edits'));
    return runTransaction(db, async (tx) => { const before = await tx.get(ref); if (!before.exists())
        throw new Error('comment_not_found'); tx.set(history, { before: before.data().content, after: content.trim(), createdBy: uid, createdAt: serverTimestamp() }); tx.update(ref, { content: content.trim(), lastEditId: history.id, moderatedBy: uid, moderatedAt: serverTimestamp() }); });
}
