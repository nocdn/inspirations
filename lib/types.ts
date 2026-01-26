export type ImageItem = {
  id: string
  imageUrl: string
  title: string
  comment?: string
  dateCreated: string
}

export type ImageItemWithEdit = ImageItem & {
  onCommentChange?: (comment: string) => void
}
