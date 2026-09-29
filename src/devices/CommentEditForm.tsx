import { useState } from 'react';
import { editComment } from './commentRepository';
import type { DeviceComment } from './models';
export function CommentEditForm({ comment, deviceId, uid }: {
    comment: DeviceComment;
    deviceId: string;
    uid: string;
}) { const [content, setContent] = useState(comment.content), [message, setMessage] = useState(''); return <form onSubmit={e => { e.preventDefault(); if (!content.trim() || !confirm(`Zmiana komentarza:\n${comment.content}\n→\n${content}`))
    return; void editComment(deviceId, comment.id, content, uid).then(() => setMessage('Zapisano komentarz.')).catch(() => setMessage('Nie udało się zmienić komentarza.')); }}><label>Edytuj komentarz<textarea value={content} onChange={e => setContent(e.target.value)} required/></label><button>Zapisz komentarz</button>{message && <p role="status">{message}</p>}</form>; }
