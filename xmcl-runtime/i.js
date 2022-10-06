const { Writable } = require('stream')
const FormData = require('form-data')
const { stream, pipeline, request } = require('undici')
const { readFileSync } = require('fs')
const { Client } = require('undici')

async function testRequest() {
  const client = new Client('https://authserver.ely.by', { pipelining: 6 })
  const res = await request('https://authserver.ely.by/api/authlib-injector/sessionserver/session/minecraft/profile/42a0074dea15474cb7933bf0ad55fd75?unsigned=true', {
    method: 'GET',
    dispatcher: client,
  })

  const result = await res.body.json()
  console.log('got first result:')
  console.log(result)

  const form = new FormData()
  form.append('file', readFileSync('C:\\Users\\CIJhn\\Documents\\CI010.png'), { contentType: 'image/png', filename: 'CI010.png' })
  form.append('model', 'steve')

  const response = await request('https://authserver.ely.by/api/authlib-injector/api/user/profile/42a0074dea15474cb7933bf0ad55fd75/skin', {
    method: 'PUT',
    body: form.getBuffer(),
    headers: {
      ...form.getHeaders(),
      authorization: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJpYXQiOjE2NjQ5ODEwNDUsImV4cCI6MTY2NTE1Mzg0NSwic2NvcGUiOiJtaW5lY3JhZnRfc2VydmVyX3Nlc3Npb24iLCJlbHktY2xpZW50LXRva2VuIjoiYV9wb0l5aWxwaDBYaHpvY1kweUt6VHlkcm5wSTUwMzM0SUJILS1VM3pveU91OTlyY2UwenlMTm1DMXNOODlLTnFIZERSaU5ZQUZXcklXSHA3NTBvSlZtT1hIdXRVczFJIiwic3ViIjoiZWx5fDQwODMzOTMifQ.JkKj5RIcLodvFHTPnTWYcas3y4sBFziwv8ptgRj3fXSlWdLzwOPswi775u3Sh_RRnlL5yCWYIFH9AlPA3iSOZQ',
    },
    dispatcher: client,
  })

  const text = await response.body.text()
  console.log(text)

  return text
}

testRequest()
