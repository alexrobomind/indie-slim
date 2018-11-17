function assert(should_be_true, msg) {
	if(!should_be_true) throw(msg);
}

class Distribution {
	constructor() {
		this.dist = [];
	}
	
	map(func) {
		result = new Distribution();
		
		for entry of this.dist {
			state = entry.state;
			probability = entry.p;
			
			sub_distribution = func(state);
			
			for sub_entry in sub_distribution.dist {
				sub_state = sub_entry.state;
				sub_prob  = sub_entry.p;
				
				var index = result.dist.findIndex(x => x.state.equals(sub_state));
				
				if index != -1
					result.dist[index].p += probability * sub_prob;
				else
					result.dist.push({state: sub_state, p: probability * sub_prob});
			}
		}
		
		return result;
	}
	
	static singleton(object) {
		result = new Distribution();
		result.dist = {state: object, p: 1};
		return result;
	}	
}
