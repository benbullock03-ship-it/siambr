<script lang="ts">
	import { T } from '@threlte/core';
</script>

<!-- Even, cool daylight through the glass, as the scan shows; the cornice uplighters warm the oak. -->
<T.HemisphereLight args={['#f4f4f2', '#8a8378', 1.0]} />
<T.AmbientLight intensity={0.35} color="#f6f1e8" />
<T.DirectionalLight position={[0, -10, 0]} intensity={0.5} color="#ffe9d0" />
<T.DirectionalLight
	position={[6, 14, 4]}
	intensity={1.5}
	color="#fdfcfa"
	castShadow
	shadow.mapSize.width={2048}
	shadow.mapSize.height={2048}
	shadow.camera.left={-18}
	shadow.camera.right={18}
	shadow.camera.top={18}
	shadow.camera.bottom={-18}
	shadow.camera.near={1}
	shadow.camera.far={40}
	shadow.bias={-0.0005}
/>
