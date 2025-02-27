import { CollectionResponse } from './dto/collection-response';
import { GenericContentItem } from './dto/generic-content-item';
import { SdkItem } from './dto/sdk-item';
import { RootUrlService } from './root-url.service';
import { ServiceMetadata } from './service-metadata';
import { GetAllArgs } from './services/get-all-args';
import { ODataFilterSerializer } from './services/odata-filter-serializer';

export class RestService {
    public static getUnboundType<T>(args: {
        Name: string,
        BaseURL?: string,
        Data?: object,
        AdditionalQueryParams?: {
            [key: string]: string;
        },
        AdditionalHeaders?: {
            [key: string]: string;
        }
    }): Promise<T> {
        const headers = args.AdditionalHeaders || {};
        const queryParams = args.AdditionalQueryParams || {};
        const baseURL = args.BaseURL || RestService.buildItemBaseUrl(args.Name);
        const wholeUrl = `${baseURL}${RestService.buildQueryParams(queryParams)}`;

        return this.sendRequest({ url: wholeUrl, headers });
    }

    public static getItemWithFallback<T extends SdkItem>(itemType: string, id: string, provider: string): Promise<T> {
        const wholeUrl = `${RestService.buildItemBaseUrl(itemType)}(${id})/Default.GetItemWithFallback()${RestService.buildQueryParams({
            sf_provider: provider,
            sf_fallback_prop_names: '*',
            $select: '*'
        })}`;

        return this.sendRequest<T>({ url: wholeUrl });
    }

    public static getCustomItems<T extends SdkItem>(baseURL: string, action: string, queryParamsForMethod: any, contentText: string = ''): any{
        const actionName = `${action}(${contentText})`;
        const wholeUrl = `${RestService.buildItemBaseUrl(baseURL)}/${actionName}${RestService.buildQueryParams(queryParamsForMethod)}`;

        return this.sendRequest<T>({ url: wholeUrl });
    }

    public static getItemWithStatus<T extends SdkItem>(itemType: string, id: string, provider: string, queryParams: {[key: string]: string}): Promise<T> {
        let queryParamsForMethod = {
            sf_provider: provider,
            $select: '*'
        };

        queryParamsForMethod = Object.assign(queryParamsForMethod, queryParams);
        const wholeUrl = `${RestService.buildItemBaseUrl(itemType)}(${id})/Default.GetItemWithStatus()${RestService.buildQueryParams(queryParamsForMethod)}`;

        return this.sendRequest<T>({ url: wholeUrl });
    }

    public static getItem<T extends SdkItem>(itemType: string, id: string, provider: string, culture?: string): Promise<T> {
        let queryParamsForMethod: {[key: string]: string; } = {
            sf_provider: provider,
            $select: '*'
        };

        if (culture) {
            queryParamsForMethod['sf_culture'] = culture;
        }

        const wholeUrl = `${this.buildItemBaseUrl(itemType)}(${id})${this.buildQueryParams(queryParamsForMethod)}`;

        return this.sendRequest<T>({ url: wholeUrl });
    }

    public static getSharedContent(id: string, cultureName: string): Promise<GenericContentItem> {
        let queryParamsForMethod = {
            sf_culture: cultureName,
            sf_fallback_prop_names: 'Content'
        };

        const wholeUrl = `${RestService.buildItemBaseUrl(RestSdkTypes.GenericContent)}/Default.GetItemById(itemId=${id})${RestService.buildQueryParams(queryParamsForMethod)}`;
        return this.sendRequest<GenericContentItem>({ url: wholeUrl });
    }

    public static getItems<T extends SdkItem>(args: GetAllArgs): Promise<CollectionResponse<T>> {

        const filteredSimpleFields = this.getSimpleFields(args.Type, args.Fields || []);
        const filteredRelatedFields = this.getRelatedFields(args.Type, args.Fields || []);

        let queryParamsForMethod: { [key: string]: any } = {
            '$count': args.Count,
            '$orderby': args.OrderBy ? args.OrderBy.map(x => `${x.Name} ${x.Type}`) : null,
            'sf_provider': args.Provider,
            'sf_culture': args.Culture,
            '$select': filteredSimpleFields.join(','),
            '$expand': filteredRelatedFields.join(','),
            '$skip': args.Skip,
            '$top': args.Take,
            '$filter': args.Filter ? new ODataFilterSerializer().serialize({ Type: args.Type, Filter: args.Filter }) : null
        };

        queryParamsForMethod = Object.assign(queryParamsForMethod, args.AdditionalQueryParams);

        const wholeUrl = `${this.buildItemBaseUrl(args.Type)}${this.buildQueryParams(queryParamsForMethod)}`;
        return this.sendRequest<{ value: T[], '@odata.count'?: number }>({ url: wholeUrl }).then((x) => {
            return <CollectionResponse<T>>{ Items: x.value, TotalCount: x['@odata.count'] };
        });
    }

    private static getSimpleFields(type: string, fields: string[]): string[] {
        let star = '*';
        if (fields != null && fields.length === 1 && fields[0] === star) {
            return [star];
        }

        let simpleFields = ServiceMetadata.getSimpleFields(type);
        return fields.filter(x => simpleFields.some(y => y === x));
    }

    private static getRelatedFields(type: string, fields: string[]): string[] {
        let star = '*';
        if (fields != null && fields.length === 1 && fields[0] === star) {
            return [star];
        }

        const result: string[] = [];
        const relatedFields = ServiceMetadata.getRelationFields(type);
        const pattern = /(?<fieldName>.+?)\((?<nested>.+)\)/;
        fields.forEach((field) => {
            const fieldMatch = field.match(pattern);
            if (!fieldMatch && relatedFields.some(x => x === field)) {
                result.push(field);
            } else if (fieldMatch && fieldMatch.groups) {
                const fieldName = fieldMatch.groups['fieldName'];
                if (relatedFields.some(x => x === fieldName)) {
                    const innerFields = fieldMatch.groups['nested'];
                    const relatedFieldsInput = this.parseInnerFields(innerFields);

                    const relatedTypeName = ServiceMetadata.getRelatedType(type, fieldName);
                    if (relatedTypeName) {
                        let relatedSimpleFields = ServiceMetadata.getSimpleFields(relatedTypeName);
                        relatedSimpleFields = relatedFieldsInput.filter(x => relatedSimpleFields.some(y => y === x));

                        let simpleFieldsJoined: string | null = null;
                        if (relatedSimpleFields.length > 0) {
                            simpleFieldsJoined = relatedSimpleFields.join(',');
                            simpleFieldsJoined = `$select=${simpleFieldsJoined}`;
                        }

                        const relatedRelationFields = RestService.getRelatedFields(relatedTypeName, relatedFieldsInput);
                        let relatedRelationFieldsJoined: string | null = null;
                        if (relatedRelationFields.length > 0) {
                            relatedRelationFieldsJoined = relatedRelationFields.join(',');
                            relatedRelationFieldsJoined = `$expand=${relatedRelationFieldsJoined}`;
                        }

                        let resultString: string | null = null;
                        if (relatedRelationFieldsJoined && simpleFieldsJoined) {
                            resultString = `${fieldName}(${simpleFieldsJoined};${relatedRelationFieldsJoined})`;
                        } else if (relatedRelationFieldsJoined) {
                            resultString = `${fieldName}(${relatedRelationFieldsJoined})`;
                        } else if (simpleFieldsJoined) {
                            resultString = `${fieldName}(${simpleFieldsJoined})`;
                        }

                        if (resultString) {
                            result.push(resultString);
                        }
                    }
                }
            }
        });

        return result;
    }

    private static parseInnerFields(input: string): string[] {
        const allFields: string[] = [];

        let fieldStartIndex = 0;
        let charIterator = 0;
        let openingBraceCounter = 0;
        let closingBraceCounter = 0;

        for (let i = 0; i < input.length; i++) {
            charIterator++;
            const character = input[i];
            if (character === '(') {
                openingBraceCounter++;
            }

            if (character === ')') {
                closingBraceCounter++;
            }

            if (character === ',') {
                if (openingBraceCounter > 0 && openingBraceCounter === closingBraceCounter) {
                    let relatedField = input.substring(fieldStartIndex, charIterator - fieldStartIndex - 1).trim();
                    allFields.push(relatedField);
                    fieldStartIndex = charIterator + 1;
                    openingBraceCounter = 0;
                    closingBraceCounter = 0;
                } else if (openingBraceCounter === 0 && closingBraceCounter === 0) {
                    let basicField = input.substring(fieldStartIndex, charIterator - fieldStartIndex - 1).trim();
                    allFields.push(basicField);
                    fieldStartIndex = charIterator + 1;
                }
            }
        }

        if (fieldStartIndex < charIterator) {
            let lastField = input.substring(fieldStartIndex, charIterator - fieldStartIndex).trim();
            allFields.push(lastField);
        }

        return allFields;
    }

    private static buildQueryParams(queryParams: { [key: string]: string | undefined }) {
        if (!queryParams) {
            return null;
        }

        let result = '';
        Object.keys(queryParams).forEach((key) => {
            const value = queryParams[key];
            if (value) {
                result += `${key}=${value}&`;
            }
        });

        if (result !== '') {
            result = '?' + result;
            result = result.substring(0, result.length - 1);
        }

        return result;
    }

    private static buildHeaders(additionalHeaders: { [key: string]: string } | undefined) {
        let headers = { 'X-Requested-With': 'react' };
        if (!additionalHeaders) {
            return headers;
        }

        return Object.assign(headers, additionalHeaders);
    }

    public static sendRequest<T>(request: RequestData) {
        return fetch(request.url, { headers: this.buildHeaders(request.headers), method: request.method, body: request.data }).then((x => x.json())).then((x) => {
            return <T>x;
        });
    }

    public static buildItemBaseUrl(itemType: string): string {
        const serviceUrl = RootUrlService.getServiceUrl();
        const setName = ServiceMetadata.getSetNameFromType(itemType);

        return `${serviceUrl}/${setName}`;
    }
}

export class RestSdkTypes {
    public static readonly Video: string = 'Telerik.Sitefinity.Libraries.Model.Video';
    public static readonly Image: string = 'Telerik.Sitefinity.Libraries.Model.Image';
    public static readonly News: string = 'Telerik.Sitefinity.News.Model.NewsItem';
    public static readonly GenericContent: string = 'Telerik.Sitefinity.GenericContent.Model.ContentItem';
    public static readonly Pages: string = 'Telerik.Sitefinity.Pages.Model.PageNode';
}

interface RequestData {
    url: string;
    method?: string;
    headers?: { [key: string]: string };
    data?: any;
}
