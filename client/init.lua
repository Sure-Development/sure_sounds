---@param namespaceOrName string
---@param nameOrVolume string|number
---@param volumeOrNil number|nil
local playSound = function(namespaceOrName, nameOrVolume, volumeOrNil)
	local namespace, name, volume = namespaceOrName, nameOrVolume, volumeOrNil

	if not volume then
		volume = nameOrVolume --[[@as number]]
		name = namespaceOrName
		namespace = ''
	end

	SendNUIMessage({
		type = 'playSound',
		data = {
			namespace = namespace,
			name = name,
			volume = volume
		}
	})
end

exports('playSound', playSound)

RegisterNUICallback('playSound', function(data, cb)
	playSound(data.namespace, data.name, data.volume)
	cb({})
end)