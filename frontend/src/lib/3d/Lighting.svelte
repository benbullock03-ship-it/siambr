<script lang="ts">
	import { T } from '@threlte/core';
</script>

<!-- Neutral daylight down the funnel throat with a cool sky bounce; the cornice pendants and the
     downlight ring are drawn as emissive fittings, so the wall wash is not a light here. -->
<T.HemisphereLight args={['#eef1f4', '#5f5950', 0.5]} />
<T.AmbientLight intensity={0.05} color="#f6f1e8" />
<T.DirectionalLight
	position={[2, 15, 3]}
	intensity={2.1}
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
	shadow.bias={-0.0004}
	shadow.normalBias={0.02}
	shadow.radius={3}
/>
<T.DirectionalLight position={[-8, 9, -6]} intensity={0.3} color="#f3ede2" />
