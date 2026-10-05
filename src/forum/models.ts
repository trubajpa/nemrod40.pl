export type Post = { id: string; path: string; body: string; signature: string; pseudonym: boolean; createdAt: number }
export type Answer = Post & { comments: Post[] }
export type Topic = Post & { title: string; answers: Answer[] }
export type PostInput = { body: string; signature: string; pseudonym: boolean }
export type ForumAuthor = { uid: string; name: string; email: string }
