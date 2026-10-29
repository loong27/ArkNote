require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'ArkGit'
  s.version = package['version']
  s.summary = 'One-way Git pull over SSH for arkNote Reader'
  s.license = 'MIT'
  s.homepage = 'https://github.com/arknote/ark-git'
  s.author = 'arkNote'
  s.source = { :git => 'https://github.com/arknote/ark-git.git', :tag => s.version.to_s }
  s.source_files = 'ios/Plugin/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target = '14.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
