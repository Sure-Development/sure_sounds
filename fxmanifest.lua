fx_version 'cerulean'
game 'common'

name 'Sound'
description 'Sound for sure development'
node_version '22'

client_script 'client/init.lua'
server_script 'server/init.js'

ui_page 'interface/index.html'
files {
    'interface/index.html',
    'interface/assets/howler.min.js',
    'sounds/**/*'
}