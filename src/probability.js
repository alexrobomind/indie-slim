function assert(should_be_true, msg) {
	if(!should_be_true) throw(msg);
}

class Distribution {
	constructor() {
		this.probabilities = Map();
	}
	
	map(func) {
		result = new Distribution();
		
		for entry of this.probabilities.entries() {
			state = entry[0];
			probability = entry[1];
			
			sub_distribution = func(entry[0]);
			
			for sub_entry in sub_distribution.probabilities.entries() {
				sub_state = sub_entry[0];
				sub_prob  = sub_entry[1];
				
				if result.probabilities.has(sub_state)
					base_probability = result.probabilities.get(sub_state);
				else
					base_probability = 0;
				
				result.probabilities.set(sub_state, base_probability + probability * sub_prob);
			}
		}
		
		return result;
	}
	
	static wrap(object) {
		result = new Distribution();
		result.probabilities.set(object, 1);
		return result;
	}
}
