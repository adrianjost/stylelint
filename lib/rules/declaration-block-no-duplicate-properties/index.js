'use strict';

const eachDeclarationBlock = require('../../utils/eachDeclarationBlock');
const isCustomProperty = require('../../utils/isCustomProperty');
const isStandardSyntaxProperty = require('../../utils/isStandardSyntaxProperty');
const optionsMatches = require('../../utils/optionsMatches');
const report = require('../../utils/report');
const ruleMessages = require('../../utils/ruleMessages');
const validateOptions = require('../../utils/validateOptions');
const { isString } = require('../../utils/validateTypes');
const vendor = require('../../utils/vendor');

const ruleName = 'declaration-block-no-duplicate-properties';

const messages = ruleMessages(ruleName, {
	rejected: (property) => `Unexpected duplicate "${property}"`,
});

const meta = {
	url: 'https://stylelint.io/user-guide/rules/declaration-block-no-duplicate-properties',
	fixable: true,
};

/** @type {import('stylelint').Rule} */
const rule = (primary, secondaryOptions, context) => {
	return (root, result) => {
		const validOptions = validateOptions(
			result,
			ruleName,
			{ actual: primary },
			{
				actual: secondaryOptions,
				possible: {
					ignore: [
						'consecutive-duplicates',
						'consecutive-duplicates-with-different-values',
						'consecutive-duplicates-with-same-prefixless-values',
					],
					ignoreProperties: [isString],
				},
				optional: true,
			},
		);

		if (!validOptions) {
			return;
		}

		const ignoreDuplicates = optionsMatches(secondaryOptions, 'ignore', 'consecutive-duplicates');
		const ignoreDiffValues = optionsMatches(
			secondaryOptions,
			'ignore',
			'consecutive-duplicates-with-different-values',
		);
		const ignorePrefixlessSameValues = optionsMatches(
			secondaryOptions,
			'ignore',
			'consecutive-duplicates-with-same-prefixless-values',
		);

		eachDeclarationBlock(root, (eachDecl) => {
			/** @type {import('postcss').Declaration[]} */
			const decls = [];

			eachDecl((decl) => {
				const prop = decl.prop;
				const lowerProp = decl.prop.toLowerCase();
				const value = decl.value;
				const important = decl.important;

				if (!isStandardSyntaxProperty(prop)) {
					return;
				}

				if (isCustomProperty(prop)) {
					return;
				}

				// Return early if the property is to be ignored
				if (optionsMatches(secondaryOptions, 'ignoreProperties', prop)) {
					return;
				}

				// Ignore the src property as commonly duplicated in at-fontface
				if (lowerProp === 'src') {
					return;
				}

				const indexDuplicate = decls.findIndex((d) => d.prop.toLowerCase() === lowerProp);

				if (indexDuplicate !== -1) {
					const duplicateDecl = decls[indexDuplicate];
					const duplicateValue = duplicateDecl ? duplicateDecl.value : '';
					const duplicateImportant = duplicateDecl ? duplicateDecl.important : false;

					if (ignoreDiffValues || ignorePrefixlessSameValues) {
						// fails if duplicates are not consecutive
						if (indexDuplicate !== decls.length - 1) {
							if (context.fix) {
								if (!important && duplicateImportant) {
									decl.remove();
								} else {
									removePreviousDuplicate(decls, lowerProp);
								}

								return;
							}

							report({
								message: messages.rejected(prop),
								node: decl,
								result,
								ruleName,
								word: prop,
							});

							return;
						}

						if (ignorePrefixlessSameValues) {
							// fails if values of consecutive, unprefixed duplicates are equal
							if (vendor.unprefixed(value) !== vendor.unprefixed(duplicateValue)) {
								if (context.fix) {
									if (!important && duplicateImportant) {
										decl.remove();
									} else {
										removePreviousDuplicate(decls, lowerProp);
									}

									return;
								}

								report({
									message: messages.rejected(prop),
									node: decl,
									result,
									ruleName,
									word: prop,
								});

								return;
							}
						}

						// fails if values of consecutive duplicates are equal
						if (value === duplicateValue) {
							if (context.fix) {
								removePreviousDuplicate(decls, lowerProp);

								return;
							}

							report({
								message: messages.rejected(prop),
								node: decl,
								result,
								ruleName,
								word: prop,
							});

							return;
						}

						return;
					}

					if (ignoreDuplicates && indexDuplicate === decls.length - 1) {
						return;
					}

					if (context.fix) {
						if (!important && duplicateImportant) {
							decl.remove();
						} else {
							removePreviousDuplicate(decls, lowerProp);
						}

						return;
					}

					report({
						message: messages.rejected(prop),
						node: decl,
						result,
						ruleName,
						word: prop,
					});
				}

				decls.push(decl);
			});
		});
	};
};

/**
 * @param {import('postcss').Declaration[]} declarations
 * @param {string} lowerProperty
 * @returns {void}
 * */
function removePreviousDuplicate(declarations, lowerProperty) {
	const declToRemove = declarations.find((d) => d.prop.toLowerCase() === lowerProperty);

	if (declToRemove) declToRemove.remove();
}

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;
module.exports = rule;
