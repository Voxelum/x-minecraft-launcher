export interface ModrinthUsers {
  [id: string]: {
    id: string
    username: string
    access_token: string
    refresh_token: string
    expires: string
  }
}
